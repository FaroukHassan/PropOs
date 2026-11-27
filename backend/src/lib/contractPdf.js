// backend/src/lib/contractPdf.js — draws the bilingual sub-lease agreement as a PDF (English left, Arabic right)
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { clauses, premisesText, dmy, aed, COMPANY } = require('./contractText');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const FONT = {
  reg: path.join(ASSETS, 'fonts', 'Tajawal-Regular.ttf'),
  med: path.join(ASSETS, 'fonts', 'Tajawal-Medium.ttf'),
  bold: path.join(ASSETS, 'fonts', 'Tajawal-Bold.ttf'),
};
const NAVY = '#101E37';
const SAND = '#C9A96E';
const INK = '#1F2937';
const MUTED = '#6B7280';
const RULE = '#E5E7EB';

const PAGE = { w: 595.28, h: 841.89, m: 42 };
const COL_GAP = 22;
const COL_W = (PAGE.w - 2 * PAGE.m - COL_GAP) / 2;
const LEFT = PAGE.m;
const RIGHT = PAGE.m + COL_W + COL_GAP;
const BOTTOM = PAGE.h - 58;

const AR = /[ء-يٱ-ۓݐ-ݿﭐ-﷿ﹰ-﻿]/;

// ── Right-to-left text: pdfkit shapes Arabic words but lays words out left to right,
// so we break lines ourselves and place each word (or run of Latin words/numbers) from the right.
function arLines(doc, text, width) {
  const space = doc.widthOfString(' ');
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = []; let w = 0;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const ww = doc.widthOfString(word);
      if (line.length && w + space + ww > width) { lines.push(line); line = []; w = 0; }
      w += (line.length ? space : 0) + ww;
      line.push(word);
    }
    lines.push(line);
  }
  return lines;
}

function drawArLine(doc, words, xRight, y) {
  const space = doc.widthOfString(' ');
  // group neighbouring non-Arabic words so "AED 7,500" or "Al Fahd 2" keep their own order
  const runs = [];
  for (const w of words) {
    const ltr = !AR.test(w);
    const last = runs[runs.length - 1];
    if (ltr && last && last.ltr) last.text += ` ${w}`;
    else runs.push({ ltr, text: w });
  }
  let x = xRight;
  for (const r of runs) {
    // in a right-to-left line, punctuation that ends a Latin run belongs on its left
    const m = r.ltr && r.text.match(/^(.*?)([،,.:;؛]+)$/);
    const body = m ? m[1] : r.text;
    const w = doc.widthOfString(body);
    x -= w;
    doc.text(body, x, y, { lineBreak: false });
    if (m) { const p = m[2].replace(/,/g, '،'); x -= doc.widthOfString(p); doc.text(p, x, y, { lineBreak: false }); }
    x -= space;
  }
}

function arHeight(doc, text, width, gap = 2) {
  return arLines(doc, text, width).length * (doc.currentLineHeight(true) + gap);
}

function arText(doc, text, x, y, width, gap = 2) {
  const lh = doc.currentLineHeight(true) + gap;
  arLines(doc, text, width).forEach((words, i) => drawArLine(doc, words, x + width, y + i * lh));
  return arLines(doc, text, width).length * lh;
}

function sigImage(dataUrl) {
  if (!dataUrl || !/^data:image\/(png|jpeg);base64,/.test(dataUrl)) return null;
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

const dubaiTime = d => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function termsHash(terms) {
  return crypto.createHash('sha256').update(JSON.stringify(terms)).digest('hex').slice(0, 16);
}

// contract: the DB row (number, status, terms, signatures, createdAt)
function renderContract(contract) {
  const t = contract.terms;
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.m, bufferPages: true, info: { Title: `Sub-lease Agreement ${contract.number}`, Author: COMPANY.name } });
  doc.registerFont('reg', FONT.reg);
  doc.registerFont('med', FONT.med);
  doc.registerFont('bold', FONT.bold);
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  let y = PAGE.m;
  const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = PAGE.m; } };

  // ── Header
  try { doc.image(path.join(ASSETS, 'logo-navy.png'), LEFT, y, { height: 34 }); } catch { /* logo optional */ }
  doc.font('bold').fontSize(15).fillColor(NAVY).text('Sub-lease Agreement', LEFT, y + 2, { width: PAGE.w - 2 * PAGE.m, align: 'right' });
  doc.font('bold').fontSize(14);
  const titleAr = 'عقد إيجار من الباطن';
  drawArLine(doc, titleAr.split(' '), PAGE.w - PAGE.m, y + 22);
  y += 48;
  doc.font('reg').fontSize(8.5).fillColor(MUTED)
    .text(`No. ${contract.number}  ·  Issued ${dmy(new Date(contract.createdAt).toISOString().slice(0, 10))}`, LEFT, y, { width: PAGE.w - 2 * PAGE.m, align: 'right' });
  y += 14;
  doc.moveTo(LEFT, y).lineTo(PAGE.w - PAGE.m, y).lineWidth(1.5).strokeColor(SAND).stroke();
  y += 12;

  // ── Parties and key terms: label EN | value | label AR
  const [placeEn, placeAr] = premisesText(t.premises);
  const yearly = t.rentPeriod === 'YEARLY';
  const rows = [
    ['Landlord (Sakanly)', `${COMPANY.name}${COMPANY.licenseNo ? ` · Licence ${COMPANY.licenseNo}` : ''}\n${COMPANY.address} · ${COMPANY.phone} · ${COMPANY.email}`, 'المؤجر'],
    ['Tenant', [t.tenant.name, t.tenant.nationality && `Nationality: ${t.tenant.nationality}`, t.tenant.idNumber && `ID / passport: ${t.tenant.idNumber}`].filter(Boolean).join(' · '), 'المستأجر'],
    ['Contact', [t.tenant.phone, t.tenant.secondPhone, t.tenant.email].filter(Boolean).join(' · ') || '—', 'بيانات التواصل'],
    ['Emergency contact', [t.tenant.emergencyName, t.tenant.emergencyRelation && `(${t.tenant.emergencyRelation})`, t.tenant.emergencyPhone].filter(Boolean).join(' ') || '—', 'جهة اتصال للطوارئ'],
    ['Premises', placeEn, 'العين المؤجرة'],
    ['Term', t.endDate ? `${dmy(t.startDate)} to ${dmy(t.endDate)}` : `From ${dmy(t.startDate)}, month to month`, 'المدة'],
    ['Rent', yearly ? `AED ${aed(t.rent)} per year` : `AED ${aed(t.rent)} per month, due on day ${t.dueDay}`, 'الإيجار'],
    ['Security deposit', t.deposit > 0 ? `AED ${aed(t.deposit)}` : 'None', 'التأمين'],
    ['Notice period', `${t.noticeDays} days`, 'مدة الإشعار'],
  ];
  const LBL = 92; const VAL_X = LEFT + LBL; const VAL_W = PAGE.w - 2 * PAGE.m - 2 * LBL;
  for (const [en, val, ar] of rows) {
    doc.font('reg').fontSize(9);
    const h = Math.max(doc.heightOfString(val, { width: VAL_W, lineGap: 1.5 }), 12) + 8;
    ensure(h);
    doc.font('med').fontSize(8.5).fillColor(MUTED).text(en, LEFT, y + 4, { width: LBL - 6 });
    doc.font('reg').fontSize(9).fillColor(INK).text(val, VAL_X, y + 4, { width: VAL_W, lineGap: 1.5 });
    doc.font('med').fontSize(8.5).fillColor(MUTED);
    drawArLine(doc, ar.split(' '), PAGE.w - PAGE.m, y + 4);
    y += h;
    doc.moveTo(LEFT, y).lineTo(PAGE.w - PAGE.m, y).lineWidth(0.5).strokeColor(RULE).stroke();
  }
  doc.font('reg').fontSize(8.5).fillColor(MUTED);
  y += 6;
  y += arText(doc, `العين المؤجرة: ${placeAr}`, LEFT, y, PAGE.w - 2 * PAGE.m);
  y += 10;

  // ── Intro
  const introEn = `This Agreement is made between ${COMPANY.name} ("Sakanly") and ${t.tenant.name} ("the Tenant"). The parties agree as follows:`;
  const introAr = `حُرر هذا العقد بين ${COMPANY.nameAr} ويُشار إليها فيما يلي بـ سكنلي، وبين المستأجر ${t.tenant.name}، واتفق الطرفان على ما يلي:`;
  doc.font('reg').fontSize(9);
  const ih = Math.max(doc.heightOfString(introEn, { width: COL_W, lineGap: 2 }), arHeight(doc, introAr, COL_W));
  ensure(ih);
  doc.fillColor(INK).text(introEn, LEFT, y, { width: COL_W, lineGap: 2 });
  arText(doc, introAr, RIGHT, y, COL_W);
  y += ih + 10;

  // ── Clauses, side by side
  clauses(t).forEach((c, i) => {
    const n = i + 1;
    doc.font('reg').fontSize(8.8);
    const hEn = doc.heightOfString(c.en[1], { width: COL_W, lineGap: 2 });
    const hAr = arHeight(doc, c.ar[1], COL_W);
    const h = 16 + Math.max(hEn, hAr) + 9;
    ensure(Math.min(h, BOTTOM - PAGE.m));
    doc.font('bold').fontSize(9.5).fillColor(NAVY).text(`${n}. ${c.en[0]}`, LEFT, y, { width: COL_W });
    drawArLine(doc, [String(n), ...c.ar[0].split(' ')], RIGHT + COL_W, y);
    y += 16;
    doc.font('reg').fontSize(8.8).fillColor(INK).text(c.en[1], LEFT, y, { width: COL_W, lineGap: 2 });
    arText(doc, c.ar[1], RIGHT, y, COL_W);
    y += Math.max(hEn, hAr) + 9;
  });

  // ── Signatures
  ensure(170);
  y += 6;
  doc.moveTo(LEFT, y).lineTo(PAGE.w - PAGE.m, y).lineWidth(1.5).strokeColor(SAND).stroke();
  y += 12;
  doc.font('bold').fontSize(10).fillColor(NAVY).text('Signatures', LEFT, y);
  drawArLine(doc, ['التوقيعات'], PAGE.w - PAGE.m, y);
  y += 20;
  const box = (x, enLabel, arLabel, name, img, at, extra) => {
    doc.font('med').fontSize(8.5).fillColor(MUTED).text(enLabel, x, y, { width: COL_W });
    drawArLine(doc, arLabel.split(' '), x + COL_W, y);
    doc.roundedRect(x, y + 14, COL_W, 74, 6).lineWidth(0.75).strokeColor(RULE).stroke();
    const buf = sigImage(img);
    if (buf) { try { doc.image(buf, x + 10, y + 18, { fit: [COL_W - 20, 66], align: 'center', valign: 'center' }); } catch { /* bad image */ } }
    else { doc.font('reg').fontSize(8).fillColor('#9CA3AF').text('Signature / التوقيع', x, y + 46, { width: COL_W, align: 'center' }); }
    doc.font('reg').fontSize(8.5).fillColor(INK).text(`Name: ${name || ''}`, x, y + 94, { width: COL_W });
    doc.text(`Date: ${at ? dubaiTime(at) : ''}`, x, y + 107, { width: COL_W });
    if (extra) doc.font('reg').fontSize(7.5).fillColor(MUTED).text(extra, x, y + 120, { width: COL_W });
  };
  box(LEFT, `For ${COMPANY.name}`, 'عن سكنلي', contract.companySignedBy, contract.companySignature, contract.companySignedAt);
  box(RIGHT, 'Tenant', 'المستأجر', contract.tenantSignedName || t.tenant.name, contract.tenantSignature, contract.tenantSignedAt,
    contract.tenantSignedIp ? `Signed online from IP ${contract.tenantSignedIp}` : null);
  y += 140;

  // ── Footer on every page
  const range = doc.bufferedPageRange();
  const hash = termsHash(t);
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('reg').fontSize(7.5).fillColor(MUTED);
    doc.text(`${COMPANY.name} · ${contract.number} · terms ${hash}`, LEFT, PAGE.h - 40, { width: COL_W + 80, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, PAGE.w - PAGE.m - 120, PAGE.h - 40, { width: 120, align: 'right', lineBreak: false });
    if (contract.status === 'VOID') {
      doc.save().rotate(-30, { origin: [PAGE.w / 2, PAGE.h / 2] }).font('bold').fontSize(90).fillColor('#DC2626').opacity(0.12)
        .text('VOID', 0, PAGE.h / 2 - 50, { width: PAGE.w, align: 'center', lineBreak: false }).restore();
    }
  }
  doc.end();
  return done;
}

module.exports = { renderContract, termsHash, drawArLine, arText, arHeight, FONT, ASSETS, NAVY, SAND, INK, MUTED, RULE, PAGE };
