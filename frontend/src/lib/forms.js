// frontend/src/lib/forms.js — field lists for the add/edit forms, shared across pages
import { L, options, INCOME_CATS, EXPENSE_CATS, today, monthKey, unitName } from './format';

export const unitOptions = (units, filter = () => true) =>
  (units || []).filter(filter).map(u => ({ value: u.id, label: unitName(u) }));

export const spaceOptions = (units, unitId, filter = () => true) => {
  const u = (units || []).find(x => x.id === unitId);
  return (u?.spaces || []).filter(filter).map(s => ({ value: s.id, label: `${s.code} — AED ${s.monthlyRate}${s.status === 'OCCUPIED' ? ' (occupied)' : ''}` }));
};

export const buildingFields = [
  { name: 'name', label: 'Building name', required: true, placeholder: 'Sheikha Noura' },
  { name: 'area', label: 'Area', placeholder: 'Barsha Heights (TECOM)' },
  { name: 'city', label: 'City', default: 'Dubai' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export const landlordFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'notes', label: 'Notes (bank details, contract terms…)', type: 'textarea' },
];

export const unitFields = (buildings, landlords) => [
  { name: 'buildingId', label: 'Building', type: 'select', required: true, options: (buildings || []).map(b => ({ value: b.id, label: b.name })) },
  { name: 'number', label: 'Apartment no.', required: true, placeholder: '2803' },
  { name: 'mode', label: 'How it is rented', type: 'select', required: true, options: options(L.mode), default: 'PARTITIONS' },
  { name: 'occupancy', label: 'Who for', type: 'select', required: true, options: options(L.occupancy), default: 'MIX' },
  { name: 'arrangement', label: 'Arrangement', type: 'select', required: true, options: options(L.arrangement), default: 'MASTER_LEASE' },
  { name: 'landlordId', label: 'Landlord / owner', type: 'select', options: (landlords || []).map(l => ({ value: l.id, label: l.name })), show: v => v.arrangement !== 'OWNED' },
  { name: 'landlordRent', label: 'Annual rent paid to landlord (AED)', type: 'number', show: v => v.arrangement === 'MASTER_LEASE' },
  { name: 'managementFee', label: 'Management fee (%)', type: 'number', show: v => v.arrangement === 'MANAGEMENT', hint: 'Share of income Sakanly keeps' },
  { name: 'nightlyRate', label: 'Typical nightly rate (AED)', type: 'number', show: v => v.mode === 'HOLIDAY' },
  { name: 'monthlyRent', label: 'Monthly rent (AED)', type: 'number', show: v => v.mode === 'LONG_TERM' },
  { name: 'bedrooms', label: 'Bedrooms', type: 'number' },
  { name: 'bathrooms', label: 'Bathrooms', type: 'number' },
  { name: 'dewaAccount', label: 'DEWA account no.' },
  { name: 'amenities', label: 'Amenities / selling points', full: true, placeholder: 'Private fridge, balcony, gym, pool' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
  { name: 'active', label: 'Active (uncheck when you hand the apartment back)', type: 'checkbox', default: true, full: true },
];

export const spaceFields = [
  { name: 'code', label: 'Code', required: true, placeholder: 'P9, Bed 1, S3' },
  { name: 'kind', label: 'Type', type: 'select', required: true, options: options(L.spaceKind), default: 'PARTITION' },
  { name: 'monthlyRate', label: 'Monthly rent (AED)', type: 'number', required: true },
  { name: 'deposit', label: 'Deposit (AED)', type: 'number', default: 400 },
  { name: 'capacity', label: 'Persons', type: 'number', default: 1 },
  { name: 'status', label: 'Status', type: 'select', required: true, options: options(L.spaceStatus).filter(o => o.value !== 'OCCUPIED'), default: 'AVAILABLE', hint: 'Becomes "Occupied" automatically when you add a tenant' },
  { name: 'availableFrom', label: 'Available from', type: 'date' },
  { name: 'amenities', label: 'Features', placeholder: 'Big space with window, private fridge' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export const tenantFields = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'phone', label: 'Phone / WhatsApp', placeholder: '+971 5x xxx xxxx' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'nationality', label: 'Nationality' },
  { name: 'idNumber', label: 'Emirates ID / passport no.' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

// Move a tenant into a partition (or a whole long-term unit)
export const leaseFields = ({ units, tenants, fixedUnit, fixedSpace }) => [
  { name: 'tenantId', label: 'Tenant', type: 'select', required: true, placeholder: 'Choose a tenant', options: [{ value: '__new', label: '+ New tenant…' }, ...(tenants || []).map(t => ({ value: t.id, label: `${t.name}${t.phone ? ` · ${t.phone}` : ''}` }))] },
  { name: 'newName', label: 'New tenant name', required: true, show: v => v.tenantId === '__new' },
  { name: 'newPhone', label: 'New tenant phone', show: v => v.tenantId === '__new' },
  ...(fixedUnit ? [] : [{ name: 'unitId', label: 'Apartment', type: 'select', required: true, options: unitOptions(units, u => u.mode !== 'HOLIDAY'), onChange: () => ({ spaceId: '' }) }]),
  ...(fixedSpace ? [] : [{
    name: 'spaceId', label: 'Partition / bed', type: 'select', options: v => spaceOptions(units, v.unitId || fixedUnit?.id, s => s.status !== 'OCCUPIED'),
    hint: 'Leave empty for a whole-apartment (long-term) lease',
    onChange: (spaceId, v) => {
      const s = (units || []).flatMap(u => u.spaces || []).find(x => x.id === spaceId);
      return s ? { rent: s.monthlyRate, deposit: s.deposit } : {};
    },
  }]),
  { name: 'startDate', label: 'Move-in date', type: 'date', required: true, default: today(), onChange: d => (d ? { dueDay: Math.min(28, Number(d.slice(8, 10))) } : {}) },
  { name: 'endDate', label: 'End date', type: 'date', hint: 'Leave empty for month-to-month' },
  { name: 'rent', label: 'Rent (AED)', type: 'number', required: true, default: fixedSpace?.monthlyRate },
  { name: 'rentPeriod', label: 'Rent is', type: 'select', required: true, options: options(L.rentPeriod), default: 'MONTHLY' },
  { name: 'dueDay', label: 'Rent due on day', type: 'number', default: Math.min(28, Number(today().slice(8, 10))), hint: 'Day of the month rent is due (1 to 28). Follows the move-in date.' },
  { name: 'deposit', label: 'Deposit (AED)', type: 'number', default: fixedSpace?.deposit ?? 0 },
  { name: 'depositPaid', label: 'Deposit received so far', type: 'number', default: 0 },
  { name: 'broker', label: 'Broker' },
  { name: 'commission', label: 'Commission paid (AED)', type: 'number' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export const transactionFields = ({ units, preset = {} }) => [
  { name: 'type', label: 'Type', type: 'select', required: true, options: options(L.txType), default: preset.type || 'INCOME', onChange: t => ({ category: t === 'INCOME' ? 'RENT' : 'DEWA' }) },
  { name: 'category', label: 'Category', type: 'select', required: true, default: preset.category || 'RENT', options: v => (v.type === 'EXPENSE' ? EXPENSE_CATS : INCOME_CATS).map(c => ({ value: c, label: L.category[c] })) },
  { name: 'date', label: 'Date', type: 'date', required: true, default: today() },
  { name: 'amount', label: 'Amount (AED)', type: 'number', required: true },
  { name: 'description', label: 'Description', required: true, full: true, default: preset.description, placeholder: 'Rent collection, DEWA - Apt 2803…' },
  { name: 'method', label: 'Paid by', type: 'select', required: true, options: options(L.method), default: 'CASH' },
  { name: 'unitId', label: 'Apartment', type: 'select', options: unitOptions(units), default: preset.unitId, placeholder: 'Company-wide (no apartment)', onChange: () => ({ spaceId: '' }) },
  { name: 'spaceId', label: 'Partition / bed', type: 'select', options: v => spaceOptions(units, v.unitId), default: preset.spaceId, show: v => !!v.unitId },
  { name: 'periodMonth', label: 'Rent for month', type: 'month', default: preset.periodMonth || monthKey(), show: v => v.category === 'RENT', hint: 'Which month this rent covers' },
  { name: 'estimated', label: 'Amount is estimated (check the receipt later)', type: 'checkbox', full: true },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export const chequeFields = ({ units, landlords, leases }) => [
  { name: 'direction', label: 'Cheque', type: 'select', required: true, options: options(L.chequeDir), default: 'OUT' },
  { name: 'number', label: 'Cheque no.', required: true },
  { name: 'amount', label: 'Amount (AED)', type: 'number', required: true },
  { name: 'dueDate', label: 'Cheque date', type: 'date', required: true },
  { name: 'bank', label: 'Bank', placeholder: 'ADCB, Mashreq, ENBD…' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: options(L.chequeStatus), default: 'PENDING' },
  { name: 'postponedTo', label: 'Postponed to', type: 'date', show: v => v.status === 'POSTPONED' },
  { name: 'unitId', label: 'Apartment', type: 'select', options: unitOptions(units) },
  { name: 'landlordId', label: 'Landlord', type: 'select', options: (landlords || []).map(l => ({ value: l.id, label: l.name })), show: v => v.direction === 'OUT' },
  { name: 'leaseId', label: 'Tenancy', type: 'select', options: (leases || []).map(l => ({ value: l.id, label: `${l.tenant.name} — ${unitName(l.unit)}${l.space ? ` ${l.space.code}` : ''}` })), show: v => v.direction === 'IN' },
  { name: 'partyName', label: 'Name on cheque / paid from', hint: 'e.g. whose account it is drawn on' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

// units: holiday homes plus any apartment that has partitions let as holiday stays
export const bookingFields = ({ units }) => [
  { name: 'unitId', label: 'Apartment', type: 'select', required: true, options: unitOptions(units), onChange: () => ({ spaceId: '' }) },
  { name: 'spaceId', label: 'Partition', type: 'select', placeholder: 'Whole apartment',
    options: v => ((units || []).find(u => u.id === v.unitId)?.spaces || []).filter(s => s.status !== 'OCCUPIED').map(s => ({ value: s.id, label: s.code })),
    show: v => ((units || []).find(u => u.id === v.unitId)?.spaces || []).length > 0,
    hint: 'For holiday-home partitions such as Azizi Riviera 920' },
  { name: 'channel', label: 'Channel', type: 'select', required: true, options: options(L.channel), default: 'AIRBNB' },
  { name: 'guestName', label: 'Guest name', required: true },
  { name: 'guestPhone', label: 'Guest phone' },
  { name: 'checkIn', label: 'Check-in', type: 'date', required: true },
  { name: 'checkOut', label: 'Check-out', type: 'date', required: true },
  { name: 'guests', label: 'Guests', type: 'number', default: 2 },
  { name: 'reference', label: 'Booking reference' },
  { name: 'totalAmount', label: 'Total paid by guest (AED)', type: 'number', required: true },
  { name: 'channelFee', label: 'Channel commission (AED)', type: 'number', default: 0 },
  { name: 'cleaningFee', label: 'Cleaning fee (AED)', type: 'number', default: 0 },
  { name: 'tourismFee', label: 'Tourism Dirham (AED)', type: 'number', default: 0 },
  { name: 'status', label: 'Status', type: 'select', required: true, options: options(L.bookingStatus), default: 'CONFIRMED' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export const maintenanceFields = ({ units }) => [
  { name: 'unitId', label: 'Apartment', type: 'select', required: true, options: unitOptions(units) },
  { name: 'spaceCode', label: 'Partition (optional)', placeholder: 'P4' },
  { name: 'title', label: 'Problem', required: true, full: true, placeholder: 'AC not cooling' },
  { name: 'category', label: 'Category', type: 'select', required: true, options: options(L.maintCategory), default: 'GENERAL' },
  { name: 'priority', label: 'Priority', type: 'select', required: true, options: options(L.priority), default: 'NORMAL' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: options(L.maintStatus), default: 'OPEN' },
  { name: 'assignedTo', label: 'Assigned to', placeholder: 'Majed' },
  { name: 'cost', label: 'Cost (AED)', type: 'number', hint: 'Also add it to the ledger as a Maintenance expense' },
  { name: 'description', label: 'Details', type: 'textarea' },
];
