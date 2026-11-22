/**
 * The three sub papers as HTML (punch list #350): what the office previews, what the print window prints and what
 * the sub's page shows. It draws the models of `_shared/subPapers.ts` and adds no number of its own; the PDF
 * (`_shared/subPapersPdf.ts`) draws the same models.
 *
 * A sentence that waits on counsel prints inside a dashed box with a § and the words "draft wording", so no copy
 * can be mistaken for the final paper.
 *
 * Pure: strings in, a string out.
 */
import { paperMoney, statementAddsWords, statementLateWords, STATEMENT_LATE_PAYMENT_WORDS, type CounselSentence, type PaperCompany, type PaperParty, type PaymentRecord, type StatementOfAccount, type StatementRange, type WorkStatement } from '../../../supabase/functions/_shared/subPapers'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const SUB_PAPER_CSS = `
.sp{font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111827;background:#fff;max-width:720px;margin:0 auto;padding:28px 32px;box-sizing:border-box}
.sp *{box-sizing:border-box}
.sp .lh{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #111827;padding-bottom:10px}
.sp .co{font-size:17px;font-weight:700}
.sp .ad{font-size:11.5px;color:#4b5563}
.sp .doc{text-align:right;white-space:nowrap}
.sp .doc b{display:block;font-size:16px}
.sp .doc span{display:block;font-size:12px;color:#4b5563}
.sp .who{display:flex;gap:24px;margin:14px 0 12px;flex-wrap:wrap}
.sp .who>div{flex:1 1 220px;font-size:12.5px;color:#374151}
.sp .who i{display:block;font-style:normal;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#6b7280}
.sp .who b{color:#111827;font-size:13.5px}
.sp table{width:100%;border-collapse:collapse;margin-top:8px}
.sp th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;border-bottom:1px solid #d1d5db;padding:4px 6px}
.sp td{padding:5px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top}
.sp .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.sp tr.t td{font-weight:700;border-top:1px solid #111827;border-bottom:none}
.sp tr.g td{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;background:#f9fafb}
.sp .red{color:#b91c1c}.sp .grn{color:#166534}.sp .mut{color:#6b7280}
.sp .big{display:flex;justify-content:space-between;align-items:baseline;gap:12px;border:2px solid #111827;border-radius:6px;padding:9px 12px;margin:12px 0;font-size:14px;font-weight:600}
.sp .big b{font-size:19px;font-variant-numeric:tabular-nums}
.sp .box{border:1px solid #d1d5db;border-radius:6px;padding:9px 12px;margin-top:12px;font-size:12.5px}
.sp .box h4{margin:0 0 4px;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;font-weight:600}
.sp .fine{font-size:11.5px;color:#374151;margin-top:10px}
.sp .c{display:block;border:1px dashed #7c3aed;border-radius:5px;padding:5px 8px;margin-top:6px;color:#4c1d95;background:#faf5ff;font-size:11.5px}
.sp .c em{font-style:normal;font-weight:700;margin-right:5px}
.sp .c small{display:block;font-size:10px;color:#6d28d9}
.sp .foot{display:flex;justify-content:space-between;gap:12px;margin-top:18px;padding-top:8px;border-top:1px solid #d1d5db;font-size:10.5px;color:#6b7280}
.sp .tag{display:inline-block;font-size:10.5px;font-weight:700;border-radius:999px;padding:1px 7px}
.sp .tag.p{background:#fef3c7;color:#92400e}.sp .tag.f{background:#dcfce7;color:#166534}
@media (max-width:560px){.sp{padding:14px 12px;font-size:12px}.sp .lh{flex-direction:column;gap:6px}.sp .doc{text-align:left;white-space:normal}.sp th,.sp td{padding:4px 3px}.sp th{font-size:9px;letter-spacing:.02em}.sp .big{font-size:13px;padding:8px 10px}.sp .big b{font-size:16px}.sp .who{gap:10px}}
@media print{.sp{padding:0;max-width:none}}
`

const letterhead = (company: PaperCompany, title: string, lines: string[]): string =>
  `<div class="lh"><div><div class="co">${esc(company.name)}</div><div class="ad">${company.lines.map(esc).join(' · ')}</div></div><div class="doc"><b>${esc(title)}</b>${lines.filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join('')}</div></div>`

const party = (label: string, p: PaperParty): string => `<div><i>${esc(label)}</i><b>${esc(p.name)}</b>${p.lines.length ? `<br>${p.lines.map(esc).join('<br>')}` : ''}</div>`

const sentences = (list: readonly CounselSentence[]): string =>
  list.map((s) => (s.pending ? `<span class="c"><em>§</em>${esc(s.text)}<small>Draft wording. It waits on counsel and is not final.</small></span>` : `<div class="fine">${esc(s.text)}</div>`)).join('')

const foot = (left: string): string => `<div class="foot"><span>${esc(left)}</span><span>Page 1 of 1</span></div>`

export function workStatementHtml(a: WorkStatement): string {
  const rows = a.lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="n">${paperMoney(l.amount)}</td></tr>`).join('')
  const back = a.backcharges.map((b) => `<tr><td class="red">Back-charge, ${esc(b.day)}${b.reason ? ` · ${esc(b.reason)}` : ''}</td><td class="n red">${paperMoney(-b.amount)}</td></tr>`).join('')
  const pays = a.payments
    .map((p) => `<tr><td>${esc(p.day)} · ${esc(p.words)}</td><td>${esc(p.how || 'Not recorded')}</td><td>${esc(p.recordNo || '—')}</td><td class="n grn">${paperMoney(p.amount)}</td></tr>`)
    .join('')
  return `<div class="sp">${letterhead(a.company, a.title, [a.number ? `No. ${a.number}` : 'Not numbered yet', `Issued ${a.issued}`])}
<div class="who">${party('Work done by', a.sub)}<div><i>Job</i><b>${esc(a.job.label)}</b><br>${esc([a.job.address, a.job.day ? `work dated ${a.job.day}` : ''].filter(Boolean).join(' · '))}</div></div>
<table><tr><th>Work</th><th class="n">Amount</th></tr>${rows}${a.reconstructed ? '<tr><td class="mut">No priced lines. The total is read back from the money moved.</td><td></td></tr>' : ''}
<tr class="t"><td>Agreed for this work</td><td class="n">${paperMoney(a.agreed)}</td></tr>${back}${a.backcharges.length ? `<tr class="t"><td>This statement comes to</td><td class="n">${paperMoney(a.comesTo)}</td></tr>` : ''}</table>
${a.payments.length ? `<table style="margin-top:12px"><tr><th>Paid on this statement</th><th>How</th><th>Payment record</th><th class="n">Amount</th></tr>${pays}<tr class="t"><td colspan="3">Paid so far</td><td class="n">${paperMoney(a.paidSoFar)}</td></tr></table>` : '<div class="fine">Nothing paid on this statement yet.</div>'}
<div class="big"><span>Still open on this statement</span><b>${paperMoney(a.stillOpen)}</b></div>
${a.over > 0 ? `<div class="fine">Paid ${paperMoney(a.over)} past what this statement comes to. It is held as your credit.</div>` : ''}
${sentences(a.sentences.filter((s) => s.key === 'notAnInvoice'))}
${a.confirm ? `<div class="box"><h4>Confirmed by the sub</h4>${esc(a.confirm.words)}${sentences(a.sentences.filter((s) => s.key === 'confirmMeans'))}</div>` : ''}
${sentences(a.sentences.filter((s) => s.key === 'workOrderTerms'))}
<div class="fine">Something wrong? Reply to the message this came with, or call the office.</div>
${foot(a.foot)}</div>`
}

export function paymentRecordHtml(b: PaymentRecord): string {
  const applied = b.applied
    .map(
      (x) =>
        `<tr><td><b>${esc(x.sheetName)}</b> · ${esc(x.job)}${x.day ? ` · work dated ${esc(x.day)}` : ''}<br><span class="tag ${x.words === 'Paid in full' ? 'f' : 'p'}">${x.words}</span></td><td class="n">${paperMoney(x.openBefore)}</td><td class="n grn">${paperMoney(x.thisPayment)}</td><td class="n">${paperMoney(x.openAfter)}</td></tr>`,
    )
    .join('')
  const after = b.after.map((x) => `<tr><td>${esc(x.sheetName)} · ${esc(x.job)}</td><td class="n">${paperMoney(x.open)}</td></tr>`).join('')
  return `<div class="sp">${letterhead(b.company, b.title, [b.number ? `No. ${b.number}` : 'Not numbered', `Sent ${b.sentOn}`])}
<div class="who">${party('Paid to', b.sub)}<div><i>How it was sent</i><b>${esc(b.how)}</b></div></div>
<div class="big"><span>Amount sent</span><b>${paperMoney(b.amountSent)}</b></div>
<table><tr><th>Applied to</th><th class="n">Open before</th><th class="n">This payment</th><th class="n">Open after</th></tr>${applied}
${b.creditKept > 0 ? `<tr><td>Kept as your credit<br><span class="mut">Sent past what the statements needed. The next payment uses it first.</span></td><td></td><td class="n grn">${paperMoney(b.creditKept)}</td><td></td></tr>` : ''}
<tr class="t"><td>Applied</td><td></td><td class="n">${paperMoney(b.appliedTotal + b.creditKept)}</td><td></td></tr></table>
<div class="box"><h4>After this payment</h4>${b.after.length ? `<table style="margin-top:0">${after}<tr class="t"><td>Still open across ${b.after.length} ${b.after.length === 1 ? 'statement' : 'statements'}</td><td class="n">${paperMoney(b.stillOpenAfter)}</td></tr></table>` : 'Nothing is still open.'}</div>
${b.note ? `<div class="fine">Note from the office: ${esc(b.note)}</div>` : ''}
${sentences(b.sentences)}
<div class="box"><h4>Received</h4><span class="mut">${esc(b.received)}</span></div>
${foot(b.foot)}</div>`
}

export function statementOfAccountHtml(c: StatementOfAccount, range: StatementRange): string {
  const row = (r: StatementOfAccount['rows'][number]) =>
    `<tr><td><b>${esc(r.sheetName)}</b> · ${esc(r.job)}<br><span class="mut">${esc(r.words)}</span></td><td class="n">${paperMoney(r.comesTo)}</td><td class="n">${r.paid > 0 ? paperMoney(r.paid) : '—'}</td><td class="n">${r.open > 0 ? `<b>${paperMoney(r.open)}</b>` : paperMoney(0)}</td></tr>`
  const forward = c.rows.filter((r) => r.section === 'forward')
  const period = c.rows.filter((r) => r.section === 'period')
  const pays = c.lastPayments.map((p) => `<tr><td>${esc(p.day)}${p.late ? `<br><span class="mut">${esc(STATEMENT_LATE_PAYMENT_WORDS)}</span>` : ''}</td><td>${esc(p.how)}</td><td>${esc(p.number || '—')}</td><td class="n grn">${paperMoney(p.amount)}</td></tr>`).join('')
  return `<div class="sp">${letterhead(c.company, c.title, [c.number ? `No. ${c.number}` : 'Not numbered yet', c.period])}
<div class="who">${party('Account of', c.sub)}<div><i>Prepared</i><b>${esc(c.preparedOn)}</b><br>All dates are ${esc(c.zone)}</div></div>
<div class="big"><span>Still open on ${esc(c.closingDay)}</span><b>${paperMoney(c.stillOpen)}</b></div>
${c.credit > 0 ? `<div class="fine">You also hold ${paperMoney(c.credit)} with us as credit. The next payment uses it first.</div>` : ''}
<table><tr><th>Statement · job</th><th class="n">Comes to</th><th class="n">Paid</th><th class="n">Open</th></tr>
${forward.length ? `<tr class="g"><td colspan="4">Brought forward${range.from ? ' from before the period' : ''}</td></tr>${forward.map(row).join('')}` : ''}
${period.length ? `${forward.length ? '<tr class="g"><td colspan="4">Work in this period</td></tr>' : ''}${period.map(row).join('')}` : ''}
${c.rows.length === 0 ? '<tr><td colspan="4" class="mut">No statements in this period.</td></tr>' : ''}
<tr class="t"><td>Totals</td><td class="n">${paperMoney(c.totals.comesTo)}</td><td class="n">${paperMoney(c.totals.paid)}</td><td class="n">${paperMoney(c.totals.open)}</td></tr></table>
<div class="box"><h4>Last payments</h4>${c.lastPayments.length ? `<table style="margin-top:0">${pays}<tr class="t"><td colspan="3">Paid in this period</td><td class="n">${paperMoney(c.paidInPeriod)}</td></tr></table>` : 'No payments in this period.'}</div>
<div class="box"><h4>How it adds up</h4>${esc(statementAddsWords(c, range))}</div>
${statementLateWords(c) ? `<div class="fine">${esc(statementLateWords(c))}</div>` : ''}
${c.undated > 0 ? `<div class="fine">${c.undated} ${c.undated === 1 ? 'line has' : 'lines have'} no date and ${c.undated === 1 ? 'is' : 'are'} left off a statement for a period.</div>` : ''}
${c.paidThisYear ? `<div class="fine">Paid to ${esc(c.sub.name)} in ${esc(c.paidThisYear.year)} so far: ${paperMoney(c.paidThisYear.amount)}.</div>${sentences(c.sentences.filter((s) => s.key === 'notATaxForm'))}` : ''}
${sentences(c.sentences.filter((s) => s.key === 'openUnderTerms'))}
${foot(c.foot)}</div>`
}

/** A whole page for the print window: the paper, light, with its own styles. */
export function subPaperPrintPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{margin:0;background:#fff}${SUB_PAPER_CSS}</style></head><body>${body}</body></html>`
}

export function subPaperFileName(kind: 'work-statement' | 'payment-record' | 'statement-of-account', number: string, subName: string, todayYmd: string): string {
  const slug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sub'
  return `${number || kind}-${slug}-${todayYmd}.pdf`
}
