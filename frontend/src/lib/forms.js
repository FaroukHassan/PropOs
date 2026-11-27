// frontend/src/lib/forms.js — field lists for the add/edit forms, shared across pages
import { t } from './i18n';
import { L, options, INCOME_CATS, EXPENSE_CATS, today, monthKey, unitName } from './format';

export const unitOptions = (units, filter = () => true) =>
  (units || []).filter(filter).map(u => ({ value: u.id, label: unitName(u) }));

export const spaceOptions = (units, unitId, filter = () => true) => {
  const u = (units || []).find(x => x.id === unitId);
  return (u?.spaces || []).filter(filter).map(s => ({ value: s.id, label: t("{0} — AED {1}{2}", [s.code, s.monthlyRate, s.status === 'OCCUPIED' ? ' (occupied)' : '']) }));
};

export const buildingFields = [
  { name: 'name', label: t("Building name"), required: true, placeholder: t("Sheikha Noura") },
  { name: 'area', label: t("Area"), placeholder: t("Barsha Heights (TECOM)") },
  { name: 'city', label: t("City"), default: 'Dubai' },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
];

export const landlordFields = [
  { name: 'name', label: t("Name"), required: true },
  { name: 'phone', label: t("Phone") },
  { name: 'email', label: t("Email"), type: 'email' },
  { name: 'notes', label: t("Notes (bank details, contract terms…)"), type: 'textarea' },
];

export const unitFields = (buildings, landlords) => [
  { name: 'buildingId', label: t("Building"), type: 'select', required: true, options: (buildings || []).map(b => ({ value: b.id, label: b.name })) },
  { name: 'number', label: t("Apartment no."), required: true, placeholder: '2803' },
  { name: 'mode', label: t("How it is rented"), type: 'select', required: true, options: options(L.mode), default: 'PARTITIONS' },
  { name: 'occupancy', label: t("Who for"), type: 'select', required: true, options: options(L.occupancy), default: 'MIX' },
  { name: 'arrangement', label: t("Arrangement"), type: 'select', required: true, options: options(L.arrangement), default: 'MASTER_LEASE' },
  { name: 'landlordId', label: t("Landlord / owner"), type: 'select', options: (landlords || []).map(l => ({ value: l.id, label: l.name })), show: v => v.arrangement !== 'OWNED' },
  { name: 'landlordRent', label: t("Annual rent paid to landlord (AED)"), type: 'number', show: v => v.arrangement === 'MASTER_LEASE' },
  { name: 'managementFee', label: t("Management fee (%)"), type: 'number', show: v => v.arrangement === 'MANAGEMENT', hint: t("Share of income Sakanly keeps") },
  { name: 'nightlyRate', label: t("Typical nightly rate (AED)"), type: 'number', show: v => v.mode === 'HOLIDAY' },
  { name: 'monthlyRent', label: t("Monthly rent (AED)"), type: 'number', show: v => v.mode === 'LONG_TERM' },
  { name: 'bedrooms', label: t("Bedrooms"), type: 'number' },
  { name: 'bathrooms', label: t("Bathrooms"), type: 'number' },
  { name: 'dewaAccount', label: t("DEWA account no.") },
  { name: 'amenities', label: t("Amenities / selling points"), full: true, placeholder: t("Private fridge, balcony, gym, pool") },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
  { name: 'active', label: t("Active (uncheck when you hand the apartment back)"), type: 'checkbox', default: true, full: true },
];

export const spaceFields = [
  { name: 'code', label: t("Code"), required: true, placeholder: t("P9, Bed 1, S3") },
  { name: 'kind', label: t("Type"), type: 'select', required: true, options: options(L.spaceKind), default: 'PARTITION' },
  { name: 'monthlyRate', label: t("Monthly rent (AED)"), type: 'number', required: true },
  { name: 'deposit', label: t("Deposit (AED)"), type: 'number', default: 400 },
  { name: 'capacity', label: t("Persons"), type: 'number', default: 1 },
  { name: 'status', label: t("Status"), type: 'select', required: true, options: options(L.spaceStatus).filter(o => o.value !== 'OCCUPIED'), default: 'AVAILABLE', hint: t("Becomes \"Occupied\" automatically when you add a tenant") },
  { name: 'availableFrom', label: t("Available from"), type: 'date' },
  { name: 'amenities', label: t("Features"), placeholder: t("Big space with window, private fridge") },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
];

export const tenantFields = [
  { name: 'name', label: t("Full name"), required: true },
  { name: 'phone', label: t("Phone / WhatsApp"), placeholder: t("+971 5x xxx xxxx") },
  { name: 'secondPhone', label: t("Second phone"), placeholder: t("+971 5x xxx xxxx") },
  { name: 'email', label: t("Email"), type: 'email' },
  { name: 'nationality', label: t("Nationality") },
  { name: 'idNumber', label: t("Emirates ID / passport no.") },
  { name: 'emergencyName', label: t("Emergency contact name") },
  { name: 'emergencyPhone', label: t("Emergency contact phone") },
  { name: 'emergencyRelation', label: t("Relationship"), placeholder: t("e.g. brother, friend") },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
];

// Draw up a sub-lease contract from a tenancy
export const contractFields = leases => [
  { name: 'leaseId', label: t("Tenancy"), type: 'select', required: true, options: leases.map(l => ({ value: l.id, label: `${l.unit.building.name} ${l.unit.number}${l.space ? ` · ${l.space.code}` : ''} · ${l.status}` })) },
  { name: 'startDate', label: t("Start date"), type: 'date', hint: t("Leave blank to use the tenancy's dates") },
  { name: 'endDate', label: t("End date"), type: 'date', hint: t("Blank = month to month") },
  { name: 'rent', label: t("Rent (AED)"), type: 'number', hint: t("Blank = the tenancy's rent") },
  { name: 'deposit', label: t("Security deposit (AED)"), type: 'number' },
  { name: 'dueDay', label: t("Rent due on day"), type: 'number' },
  { name: 'noticeDays', label: t("Notice period (days)"), type: 'number', default: 30 },
  { name: 'includes', label: t("Rent includes (English)"), full: true, placeholder: 'electricity, water, air conditioning, internet and cleaning of the shared areas' },
  { name: 'includesAr', label: t("Rent includes (Arabic)"), full: true, placeholder: 'الكهرباء والمياه والتكييف والإنترنت وتنظيف المرافق المشتركة' },
  { name: 'specialTerms', label: t("Special terms (English)"), type: 'textarea' },
  { name: 'specialTermsAr', label: t("Special terms (Arabic)"), type: 'textarea' },
];

// Move a tenant into a partition (or a whole long-term unit)
export const leaseFields = ({ units, tenants, fixedUnit, fixedSpace }) => [
  { name: 'tenantId', label: t("Tenant"), type: 'select', required: true, placeholder: t("Choose a tenant"), options: [{ value: '__new', label: t("+ New tenant…") }, ...(tenants || []).map(tx => ({ value: tx.id, label: `${tx.name}${tx.phone ? ` · ${tx.phone}` : ''}` }))] },
  { name: 'newName', label: t("New tenant name"), required: true, show: v => v.tenantId === '__new' },
  { name: 'newPhone', label: t("New tenant phone"), show: v => v.tenantId === '__new' },
  ...(fixedUnit ? [] : [{ name: 'unitId', label: t("Apartment"), type: 'select', required: true, options: unitOptions(units, u => u.mode !== 'HOLIDAY'), onChange: () => ({ spaceId: '' }) }]),
  ...(fixedSpace ? [] : [{
    name: 'spaceId', label: t("Partition / bed"), type: 'select', options: v => spaceOptions(units, v.unitId || fixedUnit?.id, s => s.status !== 'OCCUPIED'),
    hint: t("Leave empty for a whole-apartment (long-term) lease"),
    onChange: (spaceId, v) => {
      const s = (units || []).flatMap(u => u.spaces || []).find(x => x.id === spaceId);
      return s ? { rent: s.monthlyRate, deposit: s.deposit } : {};
    },
  }]),
  { name: 'startDate', label: t("Move-in date"), type: 'date', required: true, default: today(), onChange: d => (d ? { dueDay: Math.min(28, Number(d.slice(8, 10))) } : {}) },
  { name: 'endDate', label: t("End date"), type: 'date', hint: t("Leave empty for month-to-month") },
  { name: 'rent', label: t("Rent (AED)"), type: 'number', required: true, default: fixedSpace?.monthlyRate },
  { name: 'rentPeriod', label: t("Rent is"), type: 'select', required: true, options: options(L.rentPeriod), default: 'MONTHLY' },
  { name: 'dueDay', label: t("Rent due on day"), type: 'number', default: Math.min(28, Number(today().slice(8, 10))), hint: t("Day of the month rent is due (1 to 28). Follows the move-in date.") },
  { name: 'deposit', label: t("Deposit (AED)"), type: 'number', default: fixedSpace?.deposit ?? 0 },
  { name: 'depositPaid', label: t("Deposit received so far"), type: 'number', default: 0 },
  { name: 'broker', label: t("Broker") },
  { name: 'commission', label: t("Commission paid (AED)"), type: 'number' },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
];

export const transactionFields = ({ units, preset = {} }) => [
  { name: 'type', label: t("Type"), type: 'select', required: true, options: options(L.txType), default: preset.type || 'INCOME', onChange: tx => ({ category: tx === 'INCOME' ? 'RENT' : 'DEWA' }) },
  { name: 'category', label: t("Category"), type: 'select', required: true, default: preset.category || 'RENT', options: v => (v.type === 'EXPENSE' ? EXPENSE_CATS : INCOME_CATS).map(c => ({ value: c, label: L.category[c] })) },
  { name: 'date', label: t("Date"), type: 'date', required: true, default: today() },
  { name: 'amount', label: t("Amount (AED)"), type: 'number', required: true },
  { name: 'description', label: t("Description"), required: true, full: true, default: preset.description, placeholder: t("Rent collection, DEWA - Apt 2803…") },
  { name: 'method', label: t("Paid by"), type: 'select', required: true, options: options(L.method), default: 'CASH' },
  { name: 'unitId', label: t("Apartment"), type: 'select', options: unitOptions(units), default: preset.unitId, placeholder: t("Company-wide (no apartment)"), onChange: () => ({ spaceId: '' }) },
  { name: 'spaceId', label: t("Partition / bed"), type: 'select', options: v => spaceOptions(units, v.unitId), default: preset.spaceId, show: v => !!v.unitId },
  { name: 'periodMonth', label: t("Rent for month"), type: 'month', default: preset.periodMonth || monthKey(), show: v => v.category === 'RENT', hint: t("Which month this rent covers") },
  { name: 'estimated', label: t("Amount is estimated (check the receipt later)"), type: 'checkbox', full: true },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
];

export const chequeFields = ({ units, landlords, leases }) => [
  { name: 'direction', label: t("Cheque"), type: 'select', required: true, options: options(L.chequeDir), default: 'OUT' },
  { name: 'number', label: t("Cheque no."), required: true },
  { name: 'amount', label: t("Amount (AED)"), type: 'number', required: true },
  { name: 'dueDate', label: t("Cheque date"), type: 'date', required: true },
  { name: 'bank', label: t("Bank"), placeholder: t("ADCB, Mashreq, ENBD…") },
  { name: 'status', label: t("Status"), type: 'select', required: true, options: options(L.chequeStatus), default: 'PENDING' },
  { name: 'postponedTo', label: t("Postponed to"), type: 'date', show: v => v.status === 'POSTPONED' },
  { name: 'unitId', label: t("Apartment"), type: 'select', options: unitOptions(units) },
  { name: 'landlordId', label: t("Landlord"), type: 'select', options: (landlords || []).map(l => ({ value: l.id, label: l.name })), show: v => v.direction === 'OUT' },
  { name: 'leaseId', label: t("Tenancy"), type: 'select', options: (leases || []).map(l => ({ value: l.id, label: `${l.tenant.name} — ${unitName(l.unit)}${l.space ? ` ${l.space.code}` : ''}` })), show: v => v.direction === 'IN' },
  { name: 'partyName', label: t("Name on cheque / paid from"), hint: t("e.g. whose account it is drawn on") },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
];

// units: holiday homes plus any apartment that has partitions let as holiday stays
export const bookingFields = ({ units }) => [
  { name: 'unitId', label: t("Apartment"), type: 'select', required: true, options: unitOptions(units), onChange: () => ({ spaceId: '' }) },
  { name: 'spaceId', label: t("Partition"), type: 'select', placeholder: t("Whole apartment"),
    options: v => ((units || []).find(u => u.id === v.unitId)?.spaces || []).filter(s => s.status !== 'OCCUPIED').map(s => ({ value: s.id, label: s.code })),
    show: v => ((units || []).find(u => u.id === v.unitId)?.spaces || []).length > 0,
    hint: t("For holiday-home partitions such as Azizi Riviera 920") },
  { name: 'channel', label: t("Channel"), type: 'select', required: true, options: options(L.channel), default: 'AIRBNB' },
  { name: 'guestName', label: t("Guest name"), required: true },
  { name: 'guestPhone', label: t("Guest phone") },
  { name: 'checkIn', label: t("Check-in"), type: 'date', required: true },
  { name: 'checkOut', label: t("Check-out"), type: 'date', required: true },
  { name: 'guests', label: t("Guests"), type: 'number', default: 2 },
  { name: 'reference', label: t("Booking reference") },
  { name: 'totalAmount', label: t("Total paid by guest (AED)"), type: 'number', required: true },
  { name: 'channelFee', label: t("Channel commission (AED)"), type: 'number', default: 0 },
  { name: 'cleaningFee', label: t("Cleaning fee (AED)"), type: 'number', default: 0 },
  { name: 'tourismFee', label: t("Tourism Dirham (AED)"), type: 'number', default: 0 },
  { name: 'status', label: t("Status"), type: 'select', required: true, options: options(L.bookingStatus), default: 'CONFIRMED' },
  { name: 'notes', label: t("Notes"), type: 'textarea' },
];

export const maintenanceFields = ({ units }) => [
  { name: 'unitId', label: t("Apartment"), type: 'select', required: true, options: unitOptions(units) },
  { name: 'spaceCode', label: t("Partition (optional)"), placeholder: 'P4' },
  { name: 'title', label: t("Problem"), required: true, full: true, placeholder: t("AC not cooling") },
  { name: 'category', label: t("Category"), type: 'select', required: true, options: options(L.maintCategory), default: 'GENERAL' },
  { name: 'priority', label: t("Priority"), type: 'select', required: true, options: options(L.priority), default: 'NORMAL' },
  { name: 'status', label: t("Status"), type: 'select', required: true, options: options(L.maintStatus), default: 'OPEN' },
  { name: 'assignedTo', label: t("Assigned to"), placeholder: t("Majed") },
  { name: 'cost', label: t("Cost (AED)"), type: 'number', hint: t("Also add it to the ledger as a Maintenance expense") },
  { name: 'description', label: t("Details"), type: 'textarea' },
];

// Leasing deal (brokerage: we find the tenant, the landlord pays/agrees our fee)
export const DEAL_SOURCES = ['Bayut', 'Property Finder', 'Dubizzle', 'Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Website', 'Referral', 'Walk-in', 'Other'];
export const dealFields = ({ agents = [] } = {}) => [
  { name: 'contractType', label: t('Contract'), type: 'select', required: true, options: options(L.contractType), default: 'YEARLY' },
  { name: 'status', label: t('Stage'), type: 'select', required: true, options: options(L.dealStatus), default: 'LEAD' },
  { name: 'clientName', label: t('Client name'), required: true },
  { name: 'clientPhone', label: t('Client phone'), placeholder: '+971 5x xxx xxxx' },
  { name: 'clientEmail', label: t('Client email'), type: 'email' },
  { name: 'clientNationality', label: t('Nationality') },
  { name: 'source', label: t('Lead source'), type: 'select', options: DEAL_SOURCES.map(s => ({ value: s, label: t(s) })) },
  { name: 'agent', label: t('Agent'), placeholder: agents[0] || t('Ahmed Fawzy'), hint: agents.length ? t('Used before: {0}', [agents.join(', ')]) : undefined },
  { name: 'property', label: t('Building / project'), placeholder: t('Marina Gate, Azizi Riviera…') },
  { name: 'unitNo', label: t('Unit no.') },
  { name: 'unitType', label: t('Unit type'), placeholder: t('Studio, 1BR, 2BR…') },
  { name: 'area', label: t('Area'), placeholder: t('Dubai Marina, JVC…') },
  { name: 'landlordName', label: t('Landlord / agency / hotel') },
  { name: 'landlordPhone', label: t('Landlord phone') },
  { name: 'moveIn', label: t('Move-in date'), type: 'date' },
  { name: 'months', label: t('Contract length (months)'), type: 'number', default: '', hint: v => (v.contractType === 'YEARLY' ? t('Usually 12') : t('1 to 11 months')) },
  { name: 'rent', label: t('Rent (AED)'), type: 'number', hint: v => (v.contractType === 'YEARLY' ? t('Annual rent') : t('Monthly rent')) },
  { name: 'cheques', label: t('No. of cheques'), type: 'number', show: v => v.contractType === 'YEARLY' },
  { name: 'deposit', label: t('Security deposit (AED)'), type: 'number' },
  { name: 'fee', label: t('Sakanly fee / commission (AED)'), type: 'number', hint: t('What Sakanly earns from this deal') },
  { name: 'agentCommission', label: t('Agent commission (AED)'), type: 'number' },
  { name: 'brokerName', label: t('Outside broker') },
  { name: 'brokerCommission', label: t('Broker commission (AED)'), type: 'number' },
  { name: 'viewingAt', label: t('Viewing date'), type: 'date' },
  { name: 'followUpAt', label: t('Next follow-up'), type: 'date' },
  { name: 'lostReason', label: t('Why it was cancelled'), show: v => v.status === 'CANCELLED', full: true },
  { name: 'notes', label: t('Notes'), type: 'textarea' },
];
