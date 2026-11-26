#!/usr/bin/env python3
"""
Load Sakanly's operations workbook (e.g. SAKANLY_2.xlsx) into PropOS through the import API.

  pip install openpyxl
  python3 scripts/import_sakanly_workbook.py SAKANLY_2.xlsx --api https://<backend>/api --email farouk@sakanly.com [--dry-run]

Reads three sheets:
  NOVMBER (or any month sheet with PARTITION NUMBER / TENANT NAME / FROM / TO / PRICE / FLAT NO.)
      → partitions and current tenants. Blue "HOLIDAY HOMES" rows = reserved, empty rows = vacant.
  BANK  (DATE / DB / CR / DESCREPTION / PARTOTOTN NO. / FLAT NO.)
      → income (DB) and expenses (CR) in the ledger. "SEPTEMBER RENT" counts toward September.
  UNIT PAYMENTS (DATE / AMOUNT / PAYMENTS / UNIT NO. / BANK NAME / BANK / CHEQE NO.)
      → cheques and payments to landlords. Cell colour of the date: yellow = paid, green = postponed
        (new date in the last column), white = pending.

The workbook holds tenant names and amounts: keep it out of the code repository.
"""
import argparse, datetime as dt, getpass, json, re, sys, urllib.request, urllib.error
import openpyxl

SHEIKHA_NOURA = {'2506', '1904', '2803'}
MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
MONTH_ALIASES = {'NOVMBER': 'NOVEMBER', 'SEPTMBER': 'SEPTEMBER', 'OCTOBR': 'OCTOBER', 'DECMBER': 'DECEMBER', 'FEBRUARY': 'FEBRUARY'}


def flat_building(flat):
    """'F706' → Al Fahd 2 / 706, '2803' → Sheikha Noura / 2803, '920 - AZIZI ...' → Azizi Riviera / 920"""
    s = str(flat or '').strip().upper()
    if not s:
        return None, None
    if 'AZIZI' in s or 'RIVIERA' in s or 'RIEVERA' in s or 'REIVERA' in s:
        return 'Azizi Riviera', re.sub(r'\D', '', s) or s
    num = re.sub(r'^[A-Z]+', '', s).strip()
    if num in SHEIKHA_NOURA:
        return 'Sheikha Noura', num
    return 'Al Fahd 2', num


def fill(cell):
    f = cell.fill
    if not f or f.fill_type is None:
        return 'white'
    c = f.fgColor
    if c.type == 'rgb' and c.rgb:
        rgb = c.rgb.upper()[-6:]
        return {'FFFF00': 'yellow', '00B050': 'green', '92D050': 'green', '00FF00': 'green', '00B0F0': 'blue', 'FF0000': 'red', 'FFFFFF': 'white'}.get(rgb, rgb)
    return 'white'


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return None


def tenancies(ws):
    rows, flat = [], None
    for r in range(1, ws.max_row + 1):
        code, name, frm, to, price, fl = (ws.cell(r, c).value for c in range(2, 8))
        if str(code or '').strip().upper() in ('PARTITION NUMBER', 'NO', 'NO.'):
            continue
        if not code or fl is None:
            continue
        building, unit = flat_building(fl)
        if not building:
            continue
        name = str(name).strip() if name else ''
        # yellow on the tenant's name (or on the partition, when a name is there) marks a new tenant
        is_new = bool(name) and 'yellow' in (fill(ws.cell(r, 3)), fill(ws.cell(r, 2)))
        rows.append({
            'New': 'yes' if is_new else '',
            'Building': building, 'Flat': unit, 'Partition': str(code).strip(),
            'Tenant': name, 'From': iso(frm) or '', 'To': iso(to) or '', 'Price': price if isinstance(price, (int, float)) else '',
        })
    return rows


def category_for(desc, part, incoming):
    d = f'{desc} {part}'.upper()
    if incoming:
        if 'DEAL' in d or 'COMMISSION' in d:
            return 'LEASING'
        if 'RENT' in d or 'ايجار' in d:
            return 'RENT'
        if 'BOOKING' in d or 'DEPOSIT' in d or 'تأمين' in d:
            return 'DEPOSIT'
        return 'OTHER INCOME'
    rules = [
        ('DEPOSIT REFUND', 'DEPOSIT REFUND'), ('REFUND', 'DEPOSIT REFUND'), ('DEWA', 'DEWA'), ('GAZ', 'DEWA'), ('GAS', 'DEWA'),
        ('INTERNET', 'INTERNET'), ('PHONE', 'INTERNET'), ('DU ', 'INTERNET'), ('SALARY', 'SALARIES'), ('راتب', 'SALARIES'),
        ('CLEAN', 'CLEANING'), ('AC ', 'MAINTENANCE'), ('MAINT', 'MAINTENANCE'), ('صيانة', 'MAINTENANCE'), ('LICEN', 'LICENSE'), ('الرخصة', 'LICENSE'),
        ('EJARI', 'ADMIN'), ('ايجاري', 'ADMIN'), ('FEES', 'ADMIN'), ('VAT', 'ADMIN'), ('CHARGES', 'ADMIN'), ('COMMISSION', 'COMMISSION'),
        ('مراتب', 'FURNITURE'), ('FURNIT', 'FURNITURE'), ('بارتيشن', 'FURNITURE'), ('PARTITION', 'FURNITURE'),
        ('PETROL', 'ADMIN'), ('بنزين', 'ADMIN'), ('PARKING', 'ADMIN'), ('غدا', 'ADMIN'), ('CARD', 'ADMIN'), ('ضريبة', 'ADMIN'),
        ('SECURITY', 'SECURITY'), ('RENT', 'RENT PAID'),
    ]
    for key, cat in rules:
        if key in d:
            return cat
    return 'OTHER EXPENSE'


def period_for(desc, date):
    """'SEPTEMBER RENT - ايجار سبتمبر' paid 27 Aug → 2026-09 (next occurrence of that month near the payment)"""
    up = str(desc or '').upper()
    for alias, real in MONTH_ALIASES.items():
        up = up.replace(alias, real)
    for i, m in enumerate(MONTHS, start=1):
        if m in up:
            y = date.year
            if m == 'JANUARY' and date.month == 12:
                y += 1
            if m == 'DECEMBER' and date.month == 1:
                y -= 1
            return f'{y}-{i:02d}'
    return ''


def partition_code(p):
    s = str(p or '').strip().upper()
    if not s or s in ('BULK', 'RENT', 'ALL') or len(re.findall(r'\d+', s)) > 1:
        return ''
    if re.fullmatch(r'\d+', s):
        return f'P{s}'
    if s.startswith('BED'):
        return ''  # "BED SPACE" does not say which bed
    return s


def bank(ws):
    rows = []
    for r in range(2, ws.max_row + 1):
        date, db, cr, _bal, desc, part, fl = (ws.cell(r, c).value for c in range(1, 8))
        if not isinstance(date, (dt.datetime, dt.date)) or not (db or cr):
            continue
        incoming = bool(db)
        amount = db if incoming else cr
        if not isinstance(amount, (int, float)) or amount <= 0:
            continue
        _b, unit = flat_building(fl) if fl and str(fl).strip().upper() not in ('ALL', 'HOLIDYA HOMES', 'HOLIDAY HOMES') else (None, '')
        cat = category_for(desc or '', part or '', incoming)
        notes = [] if not part or partition_code(part) else [f'Partition: {part}']
        if fl and not unit:
            notes.append(str(fl))
        rows.append({
            'Date': iso(date), 'Type': 'INCOME' if incoming else 'EXPENSE', 'Category': cat,
            'Description': str(desc or cat).strip()[:200], 'Apartment': unit or '', 'Partition': partition_code(part) if unit else '',
            'Amount': amount, 'Period': period_for(desc, date) if cat == 'RENT' else '', 'Notes': ' · '.join(notes),
        })
    return rows


def unit_payments(ws):
    rows, header = [], None
    for r in range(1, ws.max_row + 1):
        if str(ws.cell(r, 1).value or '').strip().upper() == 'DATE':
            header = r
            break
    if not header:
        return rows
    for r in range(header + 1, ws.max_row + 1):
        date, amount, desc, done, fl, account, bankname, extra = (ws.cell(r, c).value for c in range(1, 9))
        if not isinstance(date, (dt.datetime, dt.date)) or not isinstance(amount, (int, float)):
            continue
        colour = fill(ws.cell(r, 1))
        status = 'Paid' if colour == 'yellow' or str(done or '').upper() == 'DONE' else 'Postponed' if colour == 'green' else 'Pending'
        _b, unit = flat_building(fl)
        new_date = iso(extra) if isinstance(extra, (dt.datetime, dt.date)) else ''
        notes = [str(desc).strip()] if desc else []
        if extra and not new_date:
            notes.append(str(extra))
        rows.append({
            # no cheque numbers in the sheet: build a stable reference from flat, date and row
            'Cheque No': f'{unit}-{iso(date).replace("-", "")}-R{r}',
            'Date': iso(date), 'Amount': amount, 'Apartment': unit or '', 'Bank': str(bankname or '').strip(),
            'Name': f'{str(account).strip()} account' if account else '', 'Status': status, 'New Date': new_date,
            'Notes': ' · '.join(notes)[:500],
        })
    return rows


def call(api, path, body=None, token=None):
    req = urllib.request.Request(api.rstrip('/') + path, method='POST' if body is not None else 'GET',
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return json.loads(res.read() or b'null')
    except urllib.error.HTTPError as e:
        sys.exit(f'{path}: {e.code} {e.read().decode()[:300]}')


def ensure_holiday_home(api, token, building, number):
    """Azizi Riviera 920 is a holiday-home apartment let by partition; it has no rows on the month sheet."""
    units = call(api, '/units?mode=HOLIDAY', token=token)
    if any(u['number'] == number and u['building']['name'] == building for u in units):
        return
    buildings = call(api, '/buildings', token=token)
    b = next((x for x in buildings if x['name'] == building), None) or call(api, '/buildings', {'name': building, 'area': 'Meydan (MBR City)'}, token)
    call(api, '/units', {'buildingId': b['id'], 'number': number, 'mode': 'HOLIDAY', 'arrangement': 'MASTER_LEASE', 'occupancy': 'MIX'}, token)
    print(f'created holiday home {building} {number} (add its partitions on the Apartments page)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--api', required=True, help='e.g. https://propos-backend.up.railway.app/api')
    ap.add_argument('--email', required=True)
    ap.add_argument('--password', help='omit to be asked')
    ap.add_argument('--month-sheet', help='sheet with current tenants (default: the one with TENANT NAME columns)')
    ap.add_argument('--dry-run', action='store_true', help='show what would happen without saving')
    ap.add_argument('--only', choices=['tenancies', 'transactions', 'cheques'])
    a = ap.parse_args()

    wb = openpyxl.load_workbook(a.file, data_only=True)
    month_ws = wb[a.month_sheet] if a.month_sheet else next(
        (ws for ws in wb.worksheets if str(ws.cell(1, 3).value or '').strip().upper() == 'TENANT NAME'), None)
    batches = []
    if month_ws is not None:
        batches.append(('tenancies', tenancies(month_ws), {}))
    if 'BANK' in wb.sheetnames:
        batches.append(('transactions', bank(wb['BANK']), {}))
    if 'UNIT PAYMENTS' in wb.sheetnames:
        batches.append(('cheques', unit_payments(wb['UNIT PAYMENTS']), {'direction': 'OUT'}))
    if a.only:
        batches = [b for b in batches if b[0] == a.only]

    token = call(a.api, '/auth/login', {'email': a.email, 'password': a.password or getpass.getpass('Password: ')})['token']
    if not a.dry_run and not a.only:
        ensure_holiday_home(a.api, token, 'Azizi Riviera', '920')
    for kind, rows, extra in batches:
        res = call(a.api, '/import', {'kind': kind, 'rows': rows, 'dryRun': a.dry_run, **extra}, token)
        print(f'{kind:13} {len(rows):4} rows → {res["created"]} new, {res.get("updated", 0)} updated, {len(res["skipped"])} skipped'
              + (' (dry run)' if a.dry_run else ''))
        for s in res['skipped'][:10]:
            print(f'    row {s["row"]}: {s["reason"]}')


if __name__ == '__main__':
    main()
