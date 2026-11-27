// backend/src/lib/contractText.js — the sub-lease agreement: who, what, how much, and the clauses (English + Arabic)

// Sakanly's details as they appear on the contract.
const COMPANY = {
  name: 'Sakanly Stay Vacation Homes Rental L.L.C',
  nameAr: 'سكنلي ستاي لتأجير بيوت العطلات ش.ذ.م.م',
  address: 'Office 301, Warsan Building, Barsha Heights, Dubai, UAE',
  addressAr: 'مكتب 301، مبنى ورسان، برشا هايتس، دبي، الإمارات العربية المتحدة',
  phone: '+971 56 591 3200',
  email: 'info@sakanly.com',
  licenseNo: process.env.COMPANY_LICENSE_NO || '1623106', // Dubai DET commercial licence
};

const DEFAULT_INCLUDES = 'electricity, water, air conditioning, internet and cleaning of the shared areas';
const DEFAULT_INCLUDES_AR = 'الكهرباء والمياه والتكييف والإنترنت وتنظيف المرافق المشتركة';

const KIND = {
  PARTITION: ['Private room', 'غرفة خاصة'],
  ROOM: ['Room', 'غرفة'],
  BED: ['Bed space', 'سرير'],
  STUDIO: ['Studio', 'استوديو'],
};

const OCCUPANCY = {
  LADIES: ['The apartment is for ladies only; male tenants and male overnight guests are not allowed.', 'الشقة مخصصة للسيدات فقط، ولا يُسمح بسكن الرجال أو مبيتهم فيها.'],
  MEN: ['The apartment is for men only.', 'الشقة مخصصة للرجال فقط.'],
  MIX: ['The apartment is shared by men and women, each in their own room.', 'الشقة مشتركة بين رجال وسيدات، ولكلٍ منهم غرفته الخاصة.'],
  FAMILY: ['The apartment is for family occupancy.', 'الشقة مخصصة لسكن العائلات.'],
};

const ymd = d => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dmy = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const aed = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

// Everything the contract says, frozen at the moment it is drawn up (or last edited before signing).
function buildTerms({ lease, tenant, overrides = {} }) {
  const unit = lease.unit;
  const building = unit.building;
  const space = lease.space;
  const o = overrides;
  const pick = (k, fallback) => (o[k] !== undefined && o[k] !== null && o[k] !== '' ? o[k] : fallback);
  const whole = !space;
  return {
    company: COMPANY,
    tenant: {
      name: tenant.name,
      nationality: tenant.nationality || '',
      idNumber: tenant.idNumber || '',
      phone: tenant.phone || '',
      secondPhone: tenant.secondPhone || '',
      email: tenant.email || '',
      emergencyName: tenant.emergencyName || '',
      emergencyPhone: tenant.emergencyPhone || '',
      emergencyRelation: tenant.emergencyRelation || '',
    },
    premises: {
      whole,
      kind: space ? space.kind : null,
      space: space ? space.code : null,
      unit: unit.number,
      building: building.name,
      area: building.area || '',
      city: building.city || 'Dubai',
      occupancy: whole ? null : unit.occupancy,
    },
    startDate: ymd(pick('startDate', lease.startDate)),
    endDate: ymd(pick('endDate', lease.endDate)),
    rent: Number(pick('rent', lease.rent)),
    rentPeriod: lease.rentPeriod || 'MONTHLY',
    dueDay: Number(pick('dueDay', lease.dueDay || 1)),
    deposit: Number(pick('deposit', lease.deposit || 0)),
    noticeDays: Number(pick('noticeDays', 30)),
    includes: pick('includes', DEFAULT_INCLUDES),
    includesAr: pick('includesAr', DEFAULT_INCLUDES_AR),
    specialTerms: pick('specialTerms', ''),
    specialTermsAr: pick('specialTermsAr', ''),
  };
}

function premisesText(p) {
  const place = [p.building, p.area, p.city].filter(Boolean).join(', ');
  if (p.whole) return [`Apartment ${p.unit}, ${place}`, `الشقة رقم ${p.unit}، ${place}`];
  const [en, ar] = KIND[p.kind] || KIND.ROOM;
  return [`${en} ${p.space} in Apartment ${p.unit}, ${place}`, `${ar} رقم ${p.space} في الشقة رقم ${p.unit}، ${place}`];
}

// The numbered clauses, each { en: [title, body], ar: [title, body] }
function clauses(t) {
  const [placeEn, placeAr] = premisesText(t.premises);
  const yearly = t.rentPeriod === 'YEARLY';
  const occ = t.premises.occupancy && OCCUPANCY[t.premises.occupancy];
  const list = [];
  const add = (en, ar) => list.push({ en, ar });

  add(['Premises', t.premises.whole
    ? `Sakanly lets to the Tenant ${placeEn}, furnished, as listed in the move-in inventory.`
    : `Sakanly lets to the Tenant the ${placeEn}, furnished, together with the right to use the shared kitchen, bathrooms and living areas with the other occupants. ${occ ? occ[0] : ''}`.trim()],
  ['العين المؤجرة', t.premises.whole
    ? `تؤجر سكنلي للمستأجر ${placeAr}، مفروشة وفق قائمة المحتويات عند الاستلام.`
    : `تؤجر سكنلي للمستأجر ${placeAr}، مفروشة، مع حق استخدام المطبخ ودورات المياه وأماكن المعيشة المشتركة مع باقي الساكنين. ${occ ? occ[1] : ''}`.trim()]);

  add(['Term', t.endDate
    ? `This Agreement starts on ${dmy(t.startDate)} and ends on ${dmy(t.endDate)}. It may be renewed only by a new written agreement.`
    : `This Agreement starts on ${dmy(t.startDate)} and continues from month to month until either party ends it under clause 9.`],
  ['مدة العقد', t.endDate
    ? `يبدأ هذا العقد في ${dmy(t.startDate)} وينتهي في ${dmy(t.endDate)}، ولا يُجدَّد إلا بعقد مكتوب جديد.`
    : `يبدأ هذا العقد في ${dmy(t.startDate)} ويتجدد شهرياً إلى أن يُنهيه أحد الطرفين وفق البند 9.`]);

  add(['Rent', `${yearly
    ? `The rent is AED ${aed(t.rent)} per year, paid as agreed in the payment schedule or by post-dated cheques.`
    : `The rent is AED ${aed(t.rent)} per month, paid in advance on day ${t.dueDay} of each month.`} The rent includes ${t.includes}. Payment is by bank transfer, cheque, or cash against a receipt from Sakanly. Rent unpaid 7 days after its due date is a serious breach under clause 9.`],
  ['الإيجار', `${yearly
    ? `قيمة الإيجار ${aed(t.rent)} درهم سنوياً، تُدفع وفق جدول السداد المتفق عليه أو بشيكات مؤجلة.`
    : `قيمة الإيجار ${aed(t.rent)} درهم شهرياً، تُدفع مقدماً في اليوم ${t.dueDay} من كل شهر.`} ويشمل الإيجار ${t.includesAr}. يكون الدفع بتحويل بنكي أو شيك أو نقداً مقابل إيصال من سكنلي. ويُعد التأخر في سداد الإيجار أكثر من 7 أيام من تاريخ استحقاقه إخلالاً جسيماً وفق البند 9.`]);

  add(['Security deposit', t.deposit > 0
    ? `The Tenant pays a refundable security deposit of AED ${aed(t.deposit)} on signing. Sakanly returns it within 14 days after the Tenant moves out and hands back the keys, less any unpaid rent or charges and the cost of repairing damage beyond normal wear and tear. The deposit cannot be used as the last month's rent.`
    : 'No security deposit is payable under this Agreement.'],
  ['مبلغ التأمين', t.deposit > 0
    ? `يدفع المستأجر عند التوقيع مبلغ تأمين مسترد قدره ${aed(t.deposit)} درهم، تردّه سكنلي خلال 14 يوماً من إخلاء المستأجر وتسليمه المفاتيح، بعد خصم أي إيجار أو رسوم غير مدفوعة وتكلفة إصلاح أي ضرر يتجاوز الاستهلاك العادي. ولا يجوز احتساب التأمين بدلاً من إيجار الشهر الأخير.`
    : 'لا يُستحق مبلغ تأمين بموجب هذا العقد.']);

  add(['Use of the premises', 'The Tenant will use the Premises only as a private home for himself or herself. No other person may live or stay overnight in the Premises without Sakanly\'s written consent. The Tenant may not sublet, assign or share the Premises.'],
    ['استخدام العين المؤجرة', 'يلتزم المستأجر باستخدام العين المؤجرة للسكن الخاص به وحده، ولا يجوز لأي شخص آخر السكن أو المبيت فيها دون موافقة كتابية من سكنلي. ولا يجوز للمستأجر تأجيرها من الباطن أو التنازل عنها أو مشاركتها مع غيره.']);

  add(['House rules', 'The Tenant will keep the shared areas clean and tidy, keep noise low between 10 pm and 8 am, not smoke inside the apartment, not keep pets, and not bring in flammable, dangerous or illegal items. The Tenant will follow the building\'s rules and Sakanly\'s house rules, which form part of this Agreement.'],
    ['قواعد السكن', 'يلتزم المستأجر بالحفاظ على نظافة المرافق المشتركة وترتيبها، وتجنب الإزعاج من الساعة 10 مساءً حتى 8 صباحاً، وعدم التدخين داخل الشقة، وعدم اقتناء الحيوانات الأليفة، وعدم إدخال أي مواد قابلة للاشتعال أو خطرة أو ممنوعة. كما يلتزم بأنظمة المبنى وقواعد السكن الصادرة عن سكنلي، وتُعد جزءاً من هذا العقد.']);

  add(['Care and repairs', 'The Tenant will take good care of the Premises, furniture and appliances and report any fault promptly. Sakanly repairs faults from normal use; the Tenant pays for damage caused by the Tenant or the Tenant\'s visitors. The Tenant may not alter the Premises, change locks, or copy keys or access cards without Sakanly\'s consent.'],
    ['المحافظة والصيانة', 'يلتزم المستأجر بالمحافظة على العين المؤجرة والأثاث والأجهزة، والإبلاغ فوراً عن أي عطل. تتولى سكنلي إصلاح الأعطال الناتجة عن الاستخدام العادي، ويتحمل المستأجر تكلفة أي ضرر يسببه هو أو زواره. ولا يجوز للمستأجر إجراء أي تعديل أو تغيير الأقفال أو نسخ المفاتيح أو بطاقات الدخول دون موافقة سكنلي.']);

  add(['Access', 'Sakanly may enter the Premises with at least 24 hours\' notice for inspection, repairs or viewings, and at any time in an emergency.'],
    ['دخول العين المؤجرة', 'يحق لسكنلي دخول العين المؤجرة بعد إشعار المستأجر قبل 24 ساعة على الأقل للمعاينة أو الصيانة أو عرضها على الغير، وفي أي وقت في حالات الطوارئ.']);

  add(['Ending the agreement', `Either party may end this Agreement by giving the other at least ${t.noticeDays} days' written notice; WhatsApp or email is acceptable. If the Tenant leaves without this notice, the Tenant pays the rent for the notice period, which Sakanly may deduct from the deposit. Sakanly may end this Agreement with 7 days' notice if the Tenant does not pay rent within 7 days of its due date or seriously breaches this Agreement or the house rules.`],
    ['إنهاء العقد', `يحق لأي من الطرفين إنهاء هذا العقد بإشعار كتابي للطرف الآخر قبل ${t.noticeDays} يوماً على الأقل، ويُقبل الإشعار عبر واتساب أو البريد الإلكتروني. وإذا أخلى المستأجر دون هذا الإشعار التزم بإيجار مدة الإشعار، ويحق لسكنلي خصمه من مبلغ التأمين. ويحق لسكنلي إنهاء العقد بإشعار مدته 7 أيام إذا لم يسدد المستأجر الإيجار خلال 7 أيام من استحقاقه أو أخل إخلالاً جسيماً بهذا العقد أو بقواعد السكن.`]);

  add(['Moving out', 'When leaving, the Tenant will remove all belongings, leave the Premises clean and in the condition received, fair wear and tear excepted, and return all keys and access cards. Belongings left behind for more than 7 days may be disposed of.'],
    ['الإخلاء', 'يلتزم المستأجر عند الإخلاء بإخراج جميع متعلقاته، وتسليم العين المؤجرة نظيفة وبالحالة التي استلمها عليها باستثناء الاستهلاك العادي، وإعادة جميع المفاتيح وبطاقات الدخول. ويحق لسكنلي التصرف في أي متعلقات تُترك لأكثر من 7 أيام.']);

  add(['Head lease', 'The Tenant acknowledges that Sakanly holds the apartment under a lease from its owner and is entitled to let the Premises. If that lease ends for any reason, Sakanly may end this Agreement with at least 30 days\' notice and will refund any rent paid in advance and the deposit, less any amounts due.'],
    ['عقد الإيجار الأصلي', 'يقر المستأجر بأن سكنلي تستأجر الشقة من مالكها بموجب عقد إيجار ويحق لها تأجير العين المؤجرة. وإذا انتهى ذلك العقد لأي سبب، يحق لسكنلي إنهاء هذا العقد بإشعار مدته 30 يوماً على الأقل، مع رد أي إيجار مدفوع مقدماً ومبلغ التأمين بعد خصم أي مبالغ مستحقة.']);

  add(['Belongings and liability', 'Sakanly is not responsible for loss of or damage to the Tenant\'s personal belongings, except where caused by Sakanly\'s negligence. The Tenant is advised to insure them.'],
    ['المتعلقات والمسؤولية', 'لا تتحمل سكنلي مسؤولية فقدان أو تلف المتعلقات الشخصية للمستأجر إلا إذا كان ذلك بسبب إهمالها، ويُنصح المستأجر بالتأمين عليها.']);

  add(['Personal data', 'The Tenant agrees that Sakanly may keep the Tenant\'s details and a copy of the Tenant\'s ID to manage this Agreement, and share them with the building management or the authorities when required.'],
    ['البيانات الشخصية', 'يوافق المستأجر على احتفاظ سكنلي ببياناته ونسخة من هويته لإدارة هذا العقد، وعلى مشاركتها مع إدارة المبنى أو الجهات الرسمية عند الطلب.']);

  add(['Law and disputes', 'This Agreement is governed by the laws of the Emirate of Dubai and the federal laws of the United Arab Emirates. Any dispute will be referred to the Rental Disputes Centre in Dubai.'],
    ['القانون وتسوية النزاعات', 'يخضع هذا العقد لقوانين إمارة دبي والقوانين الاتحادية لدولة الإمارات العربية المتحدة، ويُحال أي نزاع إلى مركز فض المنازعات الإيجارية في دبي.']);

  add(['Language and changes', 'This Agreement is made in Arabic and English; if the two texts differ, the Arabic text prevails. This Agreement and the house rules are the whole agreement between the parties, and any change must be in writing and signed by both.'],
    ['اللغة والتعديلات', 'حُرر هذا العقد باللغتين العربية والإنجليزية، وفي حال الاختلاف بينهما يُعتمد النص العربي. ويمثل هذا العقد وقواعد السكن الاتفاق الكامل بين الطرفين، ولا يُعتد بأي تعديل ما لم يكن مكتوباً وموقعاً من الطرفين.']);

  if (t.specialTerms || t.specialTermsAr) {
    add(['Special terms', t.specialTerms || t.specialTermsAr], ['شروط خاصة', t.specialTermsAr || t.specialTerms]);
  }
  return list;
}

module.exports = { COMPANY, buildTerms, clauses, premisesText, dmy, aed, KIND, DEFAULT_INCLUDES, DEFAULT_INCLUDES_AR };
