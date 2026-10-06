/**
 * The firm's own print of a referral packet (punch list #85, item 1). The
 * office's `buildLegalPacketPrintHtml` is the desk's working copy — its gap
 * list, its worth-it line, its held count — and it was what the portal's
 * Print packet opened. This one is the paper a law firm keeps: the matter,
 * the exhibit index, the five sections as records, the firm's own fees and
 * steps, and the company's particulars for filing. Nothing the office writes
 * to itself. Light-themed HTML for `openHtmlPrintWindow`; every color is
 * literal on purpose (print surfaces pin light).
 */
import { formatLegalMoney, legalSessionWords, type LegalPacket } from './legalPacket'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { envelopeAnswersWords, envelopeKindWords, envelopeMonthsWords, envelopeSharesWords, envelopeWentOutWords, legalLastWorkWords } from './legalLienPaper'
import { firmEntryKindWords, firmFeeKindWords, firmHistoryKindWords, firmJobRecordWords, firmSaidKindWords, firmSaidRecordedBy, legalFirmStageWords } from './legalFirmWords'
import { lienFirmNext } from '../jobs/lienTimeline'
import type { LegalEntryRow } from './legalMatters'
import type { LegalPortalParticulars } from './legalPortalPayload'
import { contingencyEntries, firmDemand, firmFeeEntries, legalRunningLedger } from './legalMoney'
import { propertyKindCell, propertySourceNote } from './legalProperty'

export type FirmPacketPrintOptions = {
  preparedOn: string
  companyName: string
  firm: { name: string; handling: string }
  matter: { stage: string; noteToFirm: string; releasedAt: string | null; entries: ReadonlyArray<LegalEntryRow>; /** Entries the office held back (#85 item 29); 0 or absent says nothing. */ heldCount?: number }
  particulars: LegalPortalParticulars
}

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function row(cells: string[], num: boolean[] = []): string {
  return `<tr>${cells.map((c, i) => `<td${num[i] ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`
}
function table(head: string[], rows: string[], empty: string, foot?: string): string {
  if (rows.length === 0) return `<p class="muted">${esc(empty)}</p>`
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table>`
}

export function buildFirmPacketPrintHtml(packet: LegalPacket, opts: FirmPacketPrintOptions): string {
  const a = packet.account
  const shared = packet.theirWord.timeline.filter((e) => e.shared)
  // The firm's fees and costs, less the contingency the office books when it applies a recovery (item 5: one rule with the matter card).
  const fees = firmFeeEntries(opts.matter.entries)
  const contingency = contingencyEntries(opts.matter.entries)
  const { feesTotal, demand } = firmDemand(a.totals.balance, opts.matter.entries)
  const stage = legalFirmStageWords(opts.matter.stage)
  const firstBilled = a.ledger.find((e) => e.kind === 'invoice' && e.ymd)?.ymd ?? null

  // A. Account
  const jobsRows = a.jobs.map((j) => row([`<b>${esc(j.label)}</b>`, esc(j.name), esc(j.address), j.agingDays == null ? '—' : `${j.agingDays}d`, esc(firmJobRecordWords(j)), formatLegalMoney(j.balance)], [false, false, false, true, false, true]))
  const ledgerRows = legalRunningLedger(a.ledger).map((e) => row([`<span class="date">${esc(e.ymd ?? '—')}</span>`, esc(e.jobLabel), esc(e.text), formatLegalMoney(e.amount), formatLegalMoney(e.running)], [false, false, false, true, true]))
  const ledgerFoot = `<tr><td colspan="3"><b>Balance owed</b></td><td></td><td class="num"><b>${formatLegalMoney(a.totals.balance)}</b></td></tr>`
  const propertyRows = a.properties.map((p) => row([`<b>${esc(p.jobLabels.join(', '))}</b>`, `${esc(p.address || '—')}${propertySourceNote(p.source) ? ` <span class="muted">· ${esc(propertySourceNote(p.source))}</span>` : ''}`, esc(p.county || '—'), esc(p.owner || '—'), esc(p.legalDescription || '—'), esc(p.parcelId || '—'), esc(propertyKindCell(p.propertyKind))]))

  // B. Paper
  const agreementRows = packet.paper.agreements.map((g) => {
    const c = g.coverage
    const text = c.kind === 'signed' ? `Signed${c.signedAt ? ` ${calendarYmdInAppTzFromIso(c.signedAt)}` : ''}${c.signerName ? ` by ${c.signerName}` : ''} · ${c.source}` : c.kind === 'sent' ? `Sent ${calendarYmdInAppTzFromIso(c.sentAt)} · viewed ${c.viewCount}× · never signed` : 'Draft, never sent'
    return row([`<b>${esc(g.jobLabel)}</b>`, esc(text)])
  })
  const timelineRows = packet.paper.timelines.flatMap((t) => t.timeline.steps.map((s, i) => row([i === 0 ? `<b>${esc(t.jobLabel)}</b>${legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource) ? `<br><span class="muted">${esc(legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource))}</span>` : ''}` : '', i === 0 ? formatLegalMoney(t.openBalance) : '', esc(s.label), esc(s.dateWords), esc(s.state), esc(s.words)], [false, true, false, false, false, false])))
  const nextRows = packet.paper.timelines.map((t) => row([`<b>${esc(t.jobLabel)}</b>`, esc(lienFirmNext(t.timeline.next).words), esc(t.retainageWords || '—')]))
  const demandRows = packet.paper.demandLetters.map((d) => row([`<b>${esc(d.jobLabel)}</b>`, esc(d.sentYmd ?? 'not sent'), esc(d.method), esc(d.tracking || '—'), `${esc(d.deadlineYmd ?? '—')}${d.deadlinePassed ? ' (passed)' : ''}`, formatLegalMoney(d.amount)], [false, false, false, false, false, true]))
  const gcName = a.payer.viaGc ? a.payer.name : 'the general contractor'
  const envelopeRows = packet.paper.envelopes.flatMap((e) => {
    const main = row([`<b>${esc(e.letter)}</b>`, esc(envelopeKindWords(e)), esc(envelopeWentOutWords(e, packet.todayYmd)), formatLegalMoney(e.claim), esc(envelopeMonthsWords(e) || '—'), esc(envelopeSharesWords(e, formatLegalMoney)), esc([e.county, e.recordingNumber].filter(Boolean).join(' · ') || '—'), e.documentUrl ? `<a href="${esc(e.documentUrl)}">copy</a>` : '—'], [false, false, false, true, false, false, false, false])
    if (!e.answers) return [main]
    const w = envelopeAnswersWords(e.answers, { todayYmd: packet.todayYmd, gcName, formatMoney: formatLegalMoney })
    return [main, `<tr><td colspan="8" class="band"><b>The owner's answers</b> · ${esc(w.owner)}<br><b>Second letter</b> · ${esc(w.letterTwo)} &nbsp; <b>GC's written okay to pay ${esc(opts.companyName)} directly:</b> ${esc(w.gcOkay)}</td></tr>`]
  })

  // C. Record of contact — D. Evidence — E. Fees and steps
  const saidRows = shared.map((e) => row([`<span class="date">${esc(e.ymd)}</span>`, esc(firmSaidKindWords(e.kind)), esc(e.jobLabel ?? 'account'), esc(e.text), esc(firmSaidRecordedBy(e))]))
  const evidenceRows = packet.evidence.map((e) => row([`<b>${esc(e.jobLabel)}</b>`, `${e.reports} (${e.reportsWithGps} with GPS)`, esc(legalSessionWords(e)), `${e.hours}h`, e.firstWorkYmd ? `${esc(e.firstWorkYmd)} to ${esc(e.lastWorkYmd)}` : '—', String(e.threadNotes)], [false, false, false, true, false, true]))
  const feeRows = fees.map((e) => row([`<span class="date">${esc(e.occurred_on)}</span>`, esc(firmFeeKindWords(e.kind)), esc(e.body), formatLegalMoney(Number(e.amount ?? 0))], [false, false, false, true]))
  const feeFoot = `<tr><td colspan="3"><b>Fees and costs to date</b></td><td class="num"><b>${formatLegalMoney(feesTotal)}</b></td></tr>`
  const matterRows = opts.matter.entries.filter((e) => !(e.kind === 'fee' || e.kind === 'cost') && !e.voided_at).map((e) => row([`<span class="date">${esc(e.occurred_on)}</span>`, esc(firmEntryKindWords(e)), esc(e.body), e.amount != null && e.kind !== 'question' && e.kind !== 'answer' ? formatLegalMoney(Number(e.amount)) : '', e.via_portal ? esc(opts.firm.name) : esc(opts.companyName)], [false, false, false, true, false]))
  const officeStepRows = packet.feesAndSteps.steps.map((s) => row([esc(s.ymd ?? '—'), esc(s.jobLabel ?? ''), esc(firmHistoryKindWords(s.kind)), esc(s.text)]))

  const exhibitItems = packet.exhibits.map((x) => `<tr><td class="letter">${x.letter}</td><td>${esc(x.title)}</td><td class="num">${x.count}</td><td class="muted">${esc(exhibitHome(x.title))}</td></tr>`).join('')
  const p = opts.particulars
  const particularRows = [
    ['Legal entity', p.entity || opts.companyName],
    ['License', p.license || '—'],
    ['Registered agent', p.agent || '—'],
    ['Custodian of records', p.custodian || '—'],
    ['Affiant', p.affiant || '—'],
    ['Office', [p.phone, p.email].filter(Boolean).join(' · ') || '—'],
    ['W-9 / EIN', p.w9 || 'on request from the office'],
  ]

  return `<!doctype html><html><head><meta charset="utf-8"><title>Referral packet · ${esc(a.payer.name)}</title>
<style>
  @page { margin: 0.6in; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px -apple-system, 'Segoe UI', Roboto, sans-serif; color: #8a97a6; } @bottom-left { content: "${esc(opts.companyName)} · ${esc(a.payer.name)} · prepared ${esc(opts.preparedOn)}"; font: 9px -apple-system, 'Segoe UI', Roboto, sans-serif; color: #8a97a6; } }
  body { font: 12px/1.45 -apple-system, 'Segoe UI', Roboto, sans-serif; color: #16283c; background: #fff; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: #5a6b7e; border-bottom: 2px solid #b0662f; padding-bottom: 4px; margin: 22px 0 8px; page-break-after: avoid; }
  h2 .sec { display: inline-block; min-width: 18px; color: #b0662f; }
  h3 { font-size: 12px; margin: 12px 0 4px; page-break-after: avoid; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #ddd6c8; padding-bottom: 8px; }
  .head .co { font-weight: 700; font-size: 14px; }
  .muted { color: #8a97a6; }
  .matter { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; margin: 12px 0 4px; align-items: start; }
  .matter .who { font-size: 12.5px; }
  .matter .who b { font-size: 16px; display: block; }
  .sums { display: grid; grid-template-columns: auto auto; gap: 2px 14px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sums .big { font-size: 16px; font-weight: 700; }
  .note { background: #f1ece2; border-radius: 4px; padding: 6px 10px; margin: 8px 0 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0 8px; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: #8a97a6; border-bottom: 1px solid #ddd6c8; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee8dc; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.letter { color: #b0662f; font-weight: 700; width: 20px; }
  .date { white-space: nowrap; }
  td.band { background: #f1ece2; font-size: 11px; color: #5a6b7e; }
  td.band b { color: #16283c; }
  tfoot td { border-top: 1px solid #ddd6c8; border-bottom: none; }
  .foot { margin-top: 26px; border-top: 1px solid #ddd6c8; padding-top: 8px; font-size: 11px; color: #5a6b7e; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 18px; }
  .foot span b { color: #16283c; font-weight: 600; }
  .foot .all { grid-column: 1 / -1; margin-top: 6px; color: #8a97a6; }
  a { color: #b0662f; }
</style></head><body>
<div class="head">
  <div><div class="co">${esc(opts.companyName)}</div><div class="muted">Referral packet · prepared ${esc(opts.preparedOn)} for ${esc(opts.firm.name)}${opts.firm.handling ? ` · ${esc(opts.firm.handling)}` : ''}</div></div>
  <div style="text-align:right"><h1>Referral packet</h1><div class="muted">${esc(stage)}${opts.matter.releasedAt ? ` · referred ${esc(opts.matter.releasedAt)}` : ''}</div></div>
</div>
<div class="matter">
  <div class="who">
    <b>${esc(a.payer.name)}${a.payer.viaGc ? ' (general contractor on the job)' : ''}</b>
    ${esc(a.customerAddress || a.jobs[0]?.address || '')}${a.customerType ? ` · ${esc(a.customerType)}` : ''}<br>
    ${a.emails.length ? esc(a.emails.join(', ')) : '<span class="muted">no email on file</span>'} · ${a.phones.length ? esc(a.phones.join(', ')) : '<span class="muted">no phone on file</span>'}<br>
    <span class="muted">${a.jobs.length} job${a.jobs.length === 1 ? '' : 's'}${firstBilled ? ` · first billed ${esc(firstBilled)}` : ''}${a.totals.oldestDays != null ? ` · oldest bill ${a.totals.oldestDays} days` : ''}</span>
  </div>
  <div class="sums">
    <span class="muted">Balance owed</span><span class="big">${formatLegalMoney(a.totals.balance)}</span>
    <span class="muted">Fees and costs to date</span><span>${formatLegalMoney(feesTotal)}</span>
    <span class="muted">Demand as of ${esc(opts.preparedOn)}</span><span><b>${formatLegalMoney(demand)}</b></span>
  </div>
</div>
${opts.matter.noteToFirm ? `<div class="note"><b>From the office:</b> ${esc(opts.matter.noteToFirm)}</div>` : ''}
<h2>Exhibits</h2>
${packet.exhibits.length ? `<table><thead><tr><th></th><th>Exhibit</th><th>Items</th><th>Where</th></tr></thead><tbody>${exhibitItems}</tbody></table>` : '<p class="muted">Nothing to letter yet.</p>'}
<h2><span class="sec">A</span> Account</h2>
<h3>Who owes</h3>
${table(['Contact', 'Note', 'Email', 'Phone'], a.contacts.map((c) => row([esc(c.name), esc(c.note || '—'), esc(c.email ?? '—'), esc(c.phone ?? '—')])), 'No named contact on file.')}
<h3>Jobs in this account</h3>
${table(['Job', 'Name', 'Address', 'Age', 'On file', 'Balance'], jobsRows, 'No jobs.')}
<h3>Statement of account</h3>
${table(['Date', 'Job', 'Entry', 'Amount', 'Balance'], ledgerRows, 'No billed lines or payments recorded.', ledgerFoot)}
<h3>Property record</h3>
${table(['Job', 'Address', 'County', 'Owner of record', 'Legal description', 'Parcel', 'Kind'], propertyRows, 'No property record on file.')}
<h2><span class="sec">B</span> Paper</h2>
<h3>Agreements</h3>
${table(['Job', 'Agreement'], agreementRows, 'No agreement on file for any job in this account.')}
<h3>Where each job stands under Chapter 53</h3>
${table(['Job', 'Open', 'Step', 'Date', 'State', 'Note'], timelineRows, 'No jobs.')}
${table(['Job', 'Next on the path', 'Retainage and bond'], nextRows, 'No jobs.')}
<h3>Final demand letters sent by ${esc(opts.companyName)}</h3>
${table(['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount'], demandRows, 'No demand letter sent before referral.')}
<h3>Notices, affidavits and releases</h3>
${table(['', 'Paper', 'Went out', 'Claim', 'Months as printed', 'Jobs and shares', 'County · recording', 'Copy'], envelopeRows, 'No § 53.056 notice, affidavit or release recorded.')}
<h2><span class="sec">C</span> Record of contact</h2>
${opts.matter.heldCount ? `<p class="muted">${opts.matter.heldCount} entr${opts.matter.heldCount === 1 ? 'y' : 'ies'} held back by the office.</p>` : ''}
<p class="muted">Promises: ${packet.theirWord.decided ? `kept ${packet.theirWord.kept} of ${packet.theirWord.decided}` : 'none decided yet'}${packet.theirWord.broken ? ` · ${packet.theirWord.broken} broken` : ''}</p>
${table(['Date', 'Kind', 'Job', 'What was said', 'Recorded by'], saidRows, 'No contact on record.')}
<h2><span class="sec">D</span> Field evidence</h2>
${table(['Job', 'Field reports', 'Clock sessions', 'Hours', 'Worked', 'Job notes'], evidenceRows, 'No jobs.')}
<h2><span class="sec">E</span> Fees, costs and steps</h2>
<h3>${esc(opts.firm.name)}'s fees and costs</h3>
${table(['Date', 'Kind', 'Note', 'Amount'], feeRows, 'None recorded yet.', feeFoot)}
${contingency.length ? `<p class="muted">${esc(opts.firm.name)}'s contingency on recoveries the office applied: ${contingency.map((e) => `${formatLegalMoney(Number(e.amount ?? 0))} on ${esc(e.occurred_on)}`).join(', ')}. It is the firm's share of money collected, so it is not in the demand.</p>` : ''}
<h3>On this matter</h3>
${table(['Date', 'Entry', 'What happened', 'Amount', 'By'], matterRows, 'Nothing recorded on the matter yet.')}
<h3>What ${esc(opts.companyName)} did before referral</h3>
${table(['Date', 'Job', 'Step', 'What happened'], officeStepRows, 'No steps recorded.')}
<div class="foot">
  ${particularRows.map(([k, v]) => `<span><b>${esc(k)}</b> · ${esc(v)}</span>`).join('')}
  <span class="all">Prepared from ${esc(opts.companyName)}'s business records as of ${esc(opts.preparedOn)}. Dates in Section B are the app's reading of Chapter 53 from each job's last day of work (its last approved clock day, else its last work date, else its creation month) and the property kind.</span>
</div>
</body></html>`
}

function exhibitHome(title: string): string {
  const t = title.toLowerCase()
  if (t.startsWith('invoices')) return 'A · Statement of account'
  if (t.startsWith('property')) return 'A · Property record'
  if (t.startsWith('signed agreements')) return 'B · Agreements'
  if (t.startsWith('final demand')) return 'B · Final demand letters'
  if (t.startsWith('lien notices')) return 'B · Notices, affidavits and releases'
  if (t.startsWith('what was said')) return 'C · Record of contact'
  if (t.startsWith('field reports')) return 'D · Field evidence'
  return ''
}
