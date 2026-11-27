// backend/src/lib/invoicePdf.js — tax invoice PDF (English with Arabic labels), A4
const path = require('path');
const PDFDocument = require('pdfkit');
const { drawArLine, FONT, ASSETS, NAVY, SAND, INK, MUTED, RULE, PAGE } = require('./contractPdf');
const { COMPANY } = require('./contractText');

const aed = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = d => { if (!d) return ''; const s = new Date(d).toISOString().slice(0, 10); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; };

function renderInvoice(inv, org, paid = 0) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.m, info: { Title: `Invoice ${inv.number}`, Author: COMPANY.name } });
  doc.registerFont('reg', FONT.reg); doc.registerFont('med', FONT.med); doc.registerFont('bold', FONT.bold);
  const chunks = []; doc.on('data', c => chunks.push(c));
  const done = new Promise(r => doc.on('end', () => r(Buffer.concat(chunks))));
  const L = PAGE.m, R = PAGE.w - PAGE.m, W = R - L;
  const vatOn = inv.vat > 0;
  const trn = org.trn || process.env.COMPANY_TRN || '';
  let y = PAGE.m;

  try { doc.image(path.join(ASSETS, 'logo-navy.png'), L, y, { height: 34 }); } catch { /* optional */ }
  const titleEn = inv.kind === 'PURCHASE' ? 'Supplier Bill' : vatOn ? 'Tax Invoice' : 'Invoice';
  const titleAr = inv.kind === 'PURCHASE' ? 'فاتورة مورد' : vatOn ? 'فاتورة ضريبية' : 'فاتورة';
  doc.font('bold').fontSize(16).fillColor(NAVY).text(titleEn, L, y, { width: W, align: 'right' });
  doc.font('bold').fontSize(14); drawArLine(doc, titleAr.split(' '), R, y + 22);
  y += 50;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(1.5).strokeColor(SAND).stroke();
  y += 12;

  // From / To
  const colW = (W - 20) / 2;
  const block = (x, label, labelAr, lines) => {
    doc.font('med').fontSize(8.5).fillColor(MUTED).text(label, x, y, { width: colW });
    drawArLine(doc, labelAr.split(' '), x + colW, y);
    let yy = y + 14;
    lines.filter(Boolean).forEach((ln, i) => {
      doc.font(i === 0 ? 'bold' : 'reg').fontSize(i === 0 ? 10 : 8.8).fillColor(INK).text(ln, x, yy, { width: colW });
      yy += doc.heightOfString(ln, { width: colW }) + 2;
    });
    return yy;
  };
  const us = [COMPANY.name, COMPANY.address, `${COMPANY.phone} · ${COMPANY.email}`, COMPANY.licenseNo && `Trade licence ${COMPANY.licenseNo}`, trn && `TRN ${trn}`];
  const them = [inv.partyName, inv.partyAddress, [inv.partyPhone, inv.partyEmail].filter(Boolean).join(' · '), inv.partyTrn && `TRN ${inv.partyTrn}`];
  const sales = inv.kind === 'SALES';
  const y1 = block(L, sales ? 'From' : 'Supplier', sales ? 'من' : 'المورد', sales ? us : them);
  const y2 = block(L + colW + 20, sales ? 'Bill to' : 'Billed to', sales ? 'إلى' : 'إلى', sales ? them : us);
  y = Math.max(y1, y2) + 10;

  // meta row
  const meta = [['Invoice no.', 'رقم الفاتورة', inv.number], ['Date', 'التاريخ', dmy(inv.issueDate)], ['Due', 'الاستحقاق', dmy(inv.dueDate) || '—']];
  if (inv.supplierRef) meta.push(['Supplier ref.', 'مرجع المورد', inv.supplierRef]);
  const mw = W / meta.length;
  doc.roundedRect(L, y, W, 42, 6).fillColor('#F7F1E6').fill();
  meta.forEach(([en, ar, v], i) => {
    const x = L + i * mw + 10;
    doc.font('med').fontSize(8).fillColor(MUTED).text(en, x, y + 7, { width: mw - 20 });
    drawArLine(doc, ar.split(' '), x + mw - 20, y + 7);
    doc.font('bold').fontSize(10).fillColor(INK).text(v, x, y + 22, { width: mw - 20 });
  });
  y += 56;

  // lines table
  const cols = [
    { en: 'Description', ar: 'البيان', w: W - 300, align: 'left' },
    { en: 'Qty', ar: 'الكمية', w: 50, align: 'right' },
    { en: 'Unit price', ar: 'سعر الوحدة', w: 80, align: 'right' },
    { en: `VAT ${inv.vatRate}%`, ar: 'الضريبة', w: 75, align: 'right' },
    { en: 'Amount (AED)', ar: 'المبلغ بالدرهم', w: 95, align: 'right' },
  ];
  const head = () => {
    doc.rect(L, y, W, 30).fillColor(NAVY).fill();
    let x = L;
    for (const c of cols) {
      doc.font('med').fontSize(8.5).fillColor('#FFFFFF').text(c.en, x + 6, y + 5, { width: c.w - 12, align: c.align });
      doc.font('reg').fontSize(7.5);
      const arW = doc.widthOfString(c.ar);
      drawArLine(doc, c.ar.split(' '), c.align === 'right' ? x + c.w - 6 : x + 6 + arW, y + 17);
      x += c.w;
    }
    y += 30;
  };
  head();
  doc.fillColor(INK);
  for (const ln of inv.lines) {
    const amount = Number(ln.qty) * Number(ln.unitPrice);
    const vat = ln.vat === false ? 0 : amount * inv.vatRate / 100;
    doc.font('reg').fontSize(9);
    const h = Math.max(doc.heightOfString(ln.description, { width: cols[0].w - 12 }), 11) + 12;
    if (y + h > PAGE.h - 200) { doc.addPage(); y = PAGE.m; head(); }
    const vals = [ln.description, String(ln.qty), aed(ln.unitPrice), aed(vat), aed(amount)];
    let x = L;
    cols.forEach((c, i) => { doc.font('reg').fontSize(9).fillColor(INK).text(vals[i], x + 6, y + 6, { width: c.w - 12, align: c.align }); x += c.w; });
    y += h;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(RULE).stroke();
  }
  y += 12;

  // totals
  const tx = R - 240;
  const tot = [['Subtotal', 'المجموع قبل الضريبة', inv.subtotal], [`VAT ${inv.vatRate}%`, 'ضريبة القيمة المضافة', inv.vat], ['Total', 'الإجمالي', inv.total]];
  if (paid > 0) tot.push(['Paid', 'المدفوع', paid], ['Balance due', 'المتبقي', Math.max(inv.total - paid, 0)]);
  for (const [en, ar, v] of tot) {
    const strong = en === 'Total' || en === 'Balance due';
    if (strong) { doc.rect(tx, y - 3, 240, 22).fillColor(strong && en === 'Total' ? '#F7F1E6' : '#FFFFFF').fill(); }
    doc.font(strong ? 'bold' : 'reg').fontSize(strong ? 10.5 : 9).fillColor(INK).text(en, tx + 8, y + 2, { width: 90 });
    doc.font('reg').fontSize(8).fillColor(MUTED); drawArLine(doc, ar.split(' '), tx + 150, y + 3);
    doc.font(strong ? 'bold' : 'reg').fontSize(strong ? 10.5 : 9).fillColor(INK).text(`AED ${aed(v)}`, tx + 120, y + 2, { width: 112, align: 'right' });
    y += 22;
  }
  y += 10;
  if (inv.status === 'VOID') doc.font('bold').fontSize(12).fillColor('#DC2626').text('VOID — this invoice has been cancelled', L, y);
  else if (paid >= inv.total - 0.005 && inv.total > 0) doc.font('bold').fontSize(12).fillColor('#15803D').text('PAID', L, y);
  if (inv.notes) { y += 22; doc.font('med').fontSize(8.5).fillColor(MUTED).text('Notes', L, y); doc.font('reg').fontSize(9).fillColor(INK).text(inv.notes, L, y + 13, { width: W }); }

  doc.font('reg').fontSize(7.5).fillColor(MUTED);
  doc.page.margins.bottom = 0;
  doc.text(`${COMPANY.name}${trn ? ` · TRN ${trn}` : ''} · ${inv.number}`, L, PAGE.h - 40, { width: W, lineBreak: false });
  doc.end();
  return done;
}

module.exports = { renderInvoice };
