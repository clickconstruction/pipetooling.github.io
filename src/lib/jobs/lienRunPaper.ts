import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { demandDate, demandMoney } from '../jobsDocuments/demandLetter'
import type { RunNotice, RunRecipient } from './lienDeskRun'
import type { RunEnvelope } from './runEnvelopes'

/**
 * The run on paper (v2.4971, the owner's ask on the October 8 packet — 154 pages for 18 envelopes
 * with a paragraph per envelope on page 1 and nothing between the envelopes): page 1 is a checklist
 * written to the person at the desk, a divider page with the envelope's face sits before each
 * envelope, every page names the copy it belongs to, and an envelope that cannot be mailed — no
 * mailing address, or nothing to claim — is held back and listed in red with the reason instead
 * of printed. Pure: the run's envelopes and the pages each copy prints come in, HTML goes out.
 */

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Why an envelope cannot go out, or null when it can. */
export function runEnvelopeHold(env: Pick<RunEnvelope, 'name' | 'address' | 'method' | 'email' | 'contents'>): string | null {
  const nothing = env.contents.every((c) => !(Number(c.notice.amount) > 0.005))
  const noAddress = env.method === 'email' ? !env.email.trim() : env.method === 'hand' ? !env.name.trim() : !env.address.trim()
  if (noAddress && nothing) return `${env.method === 'email' ? 'No email on file' : 'No mailing address'}, and the claim is $0. Nothing to send. The notice stays on the desk.`
  if (noAddress) return env.method === 'email' ? 'No email on file. Set it on the customer, then send this one from the run.' : 'No mailing address. Set it on the customer, then print this envelope from the run.'
  if (nothing) return 'Nothing to send: the claim is $0. The notice stays on the desk.'
  return null
}

export type RunMailing = {
  /** The envelopes that print and go out, numbered 1 to N in run order. */
  mailed: RunEnvelope[]
  /** The envelopes held back, numbered after the mailed ones, each with its reason. */
  held: Array<{ env: RunEnvelope; why: string }>
  /** Every envelope in the order the paper lists them: mailed, then held. The run window lists the same. */
  all: RunEnvelope[]
}

/** The run's envelopes split into what goes out and what is held, renumbered so the sheet, the dividers and the window agree. */
export function runMailing(envelopes: ReadonlyArray<RunEnvelope>): RunMailing {
  const mailed: RunEnvelope[] = []
  const held: Array<{ env: RunEnvelope; why: string }> = []
  for (const env of envelopes) {
    const why = runEnvelopeHold(env)
    if (why) held.push({ env, why })
    else mailed.push(env)
  }
  const renumbered = mailed.map((env, i) => ({ ...env, n: i + 1 }))
  const heldRenumbered = held.map(({ env, why }, i) => ({ env: { ...env, n: renumbered.length + i + 1 }, why }))
  return { mailed: renumbered, held: heldRenumbered, all: [...renumbered, ...heldRenumbered.map((h) => h.env)] }
}

type DocKind = 'letter' | 'note' | 'release' | 'notice' | 'pay' | 'invoice'

function docKind(label: string): DocKind {
  const l = label.toLowerCase()
  if (l.startsWith('cover letter')) return 'letter'
  if (l.startsWith('cover note')) return 'note'
  if (l.includes('release')) return 'release'
  if (l.startsWith('pay codes')) return 'pay'
  if (l.startsWith('unpaid invoice')) return 'invoice'
  return 'notice'
}

/**
 * What a stack of documents is, from the labels the copy pages carry: "7 documents · counsel's letter,
 * the notice, the pay page, 4 unpaid invoices". Documents, not pages: a letter can run to a second
 * sheet, and a count the printer can contradict is worse than none.
 */
export function runDocumentWords(labels: ReadonlyArray<string>): { count: number; words: string } {
  const tally = new Map<DocKind, number>()
  for (const l of labels) tally.set(docKind(l), (tally.get(docKind(l)) ?? 0) + 1)
  const part = (kind: DocKind, one: string, many: (n: number) => string) => {
    const n = tally.get(kind) ?? 0
    return n === 0 ? '' : n === 1 ? one : many(n)
  }
  const parts = [
    part('letter', 'counsel’s letter', (n) => `${n} counsel’s letters`),
    part('note', 'the cover note', (n) => `${n} cover notes`),
    part('release', 'the conditional release', (n) => `${n} conditional releases`),
    part('notice', 'the notice', (n) => `${n} notices`),
    part('pay', 'the pay page', (n) => `${n} pay pages`),
    part('invoice', '1 unpaid invoice', (n) => `${n} unpaid invoices`),
  ].filter(Boolean)
  const count = labels.length
  return { count, words: count === 0 ? 'nothing' : `${count} ${count === 1 ? 'document' : 'documents'} · ${parts.join(', ')}` }
}

/** The address as the envelope reads it, case as typed: the street lines, then city, state and ZIP on one line. */
export function runAddressLines(address: string): string[] {
  const parts = address.split(/\s*,\s*|\n/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return []
  if (parts.length === 1) return parts
  const last = parts[parts.length - 1]!
  const city = parts[parts.length - 2]!
  // "SAN ANTONIO" + "TX 78230" → one line; a two-part address is street + the rest.
  return parts.length === 2 ? parts : [...parts.slice(0, -2), `${city}, ${last}`]
}

function retLines(issuer: PhysicalInvoiceIssuer | null): string[] {
  return [issuer?.companyName ?? '', ...(issuer?.addressText ?? '').split('\n')].map((l) => l.trim()).filter(Boolean)
}

function methodWords(method: RunEnvelope['method']): string {
  return method === 'certified_mail' ? 'certified mail, return receipt' : method === 'traceable_courier' ? 'traceable courier' : method === 'email' ? 'by email' : 'hand delivery'
}

function noticeLine(n: RunNotice): string {
  return `${n.label} · ${demandMoney(String(n.amount))}`
}

export type RunSheetInput = {
  mailing: RunMailing
  todayYmd: string
  issuer: PhysicalInvoiceIssuer | null
  /** The labels of the documents inside an envelope, in print order. */
  docsFor: (env: RunEnvelope) => string[]
}

/**
 * Page 1 (and on): the checklist. One row per envelope in the order the paper comes out — the
 * number, the name and address as the envelope reads them, what is inside, three ticks, and a
 * tracking box the width of the row. Held envelopes follow in red with their reason and no box.
 */
export function runSheetHtml(i: RunSheetInput): string {
  const { mailing, todayYmd, issuer } = i
  const ret = retLines(issuer)
  const docsCount = mailing.mailed.reduce((s, env) => s + i.docsFor(env).length, 0)
  const certified = mailing.mailed.every((e) => e.method === 'certified_mail')
  const intro = [
    '<b>Work down the list. Tick each box as you go.</b>',
    certified ? 'Every envelope goes certified mail with a return receipt.' : 'The method is under each name.',
    'Each envelope has a divider page in front of it with the same number as this list.',
    'Write the number from the certified slip in the box under its row.',
    'Back at the desk, type the numbers into Send the run › Record the mailing. The run checks each one as you type.',
    mailing.held.length ? `<b>${mailing.held.length} ${mailing.held.length === 1 ? 'envelope is' : 'envelopes are'} held back</b> and marked in red: the run did not print ${mailing.held.length === 1 ? 'it' : 'them'}, and the reason is beside each one.` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const row = (env: RunEnvelope, why: string | null) => {
    const lines = runAddressLines(env.address)
    const docs = why ? null : runDocumentWords(i.docsFor(env))
    const inside = env.contents.map((c) => noticeLine(c.notice)).join(' · ')
    return (
      `<tr class="runrow${why ? ' held' : ''}" data-run-sheet-envelope="${env.n}"${why ? ' data-run-held="yes"' : ''}>` +
      `<td class="n">${env.n}</td>` +
      `<td class="to"><strong>${esc(env.name || '—')}${why && !env.address.trim() && env.method !== 'email' && env.method !== 'hand' ? ' · no mailing address' : ''}</strong>` +
      (lines.length ? `<small>${lines.map(esc).join('<br>')}</small>` : '') +
      (why ? `<small class="why">${esc(why)}</small>` : env.method !== 'certified_mail' ? `<small>${esc(methodWords(env.method))}</small>` : '') +
      `</td>` +
      `<td class="in">${why ? `<b>Held</b><br>${esc(inside)}` : `<b>${esc(docs!.words.replace(/ · .*$/, ''))}</b> · ${esc(docs!.words.replace(/^[^·]*· /, ''))}<br>${env.contents.length > 1 ? `<b>${env.contents.length} notices</b> · ` : ''}${esc(inside)}`}</td>` +
      `<td class="done">${why ? '—' : '<span>☐ stuffed</span><span>☐ slip on</span><span>☐ mailed</span>'}</td>` +
      `</tr>` +
      (why ? '' : `<tr class="runtrk"><td colspan="4"><div><span class="lab">Tracking number</span><span class="box"><small>${env.method === 'certified_mail' ? '20 digits from the green slip' : env.method === 'hand' ? 'who signed for it' : 'the carrier’s number'}</small></span></div></td></tr>`)
    )
  }
  return (
    `<div class="runsheet" data-run-sheet>` +
    `<div class="hdr"><div class="co">${esc(ret[0] ?? '')}</div><div class="r">${ret.slice(1).map(esc).join('<br>')}${issuer?.phone ? `<br>${esc(issuer.phone)}` : ''}</div></div>` +
    `<h1>Today’s mail <span>· ${mailing.mailed.length} ${mailing.mailed.length === 1 ? 'envelope' : 'envelopes'} · ${docsCount} ${docsCount === 1 ? 'document' : 'documents'} · ${esc(demandDate(todayYmd))}</span></h1>` +
    `<div class="toyou">${intro}</div>` +
    `<table><thead><tr><th class="n">#</th><th>Make the envelope out to</th><th>Inside</th><th class="done">Done</th></tr></thead><tbody>` +
    mailing.mailed.map((env) => row(env, null)).join('') +
    mailing.held.map(({ env, why }) => row(env, why)).join('') +
    `</tbody></table>` +
    `<div class="runsheetfoot">Today’s mail · ${esc(demandDate(todayYmd))}</div>` +
    `</div>`
  )
}

/**
 * The divider before an envelope: a black band along the top edge so it shows in the stack, the
 * envelope's face as the envelope printer prints it, the number large, what follows, three ticks and
 * the tracking box. It is pulled before sealing and stays on the desk; it never goes in the envelope.
 */
export function runDividerHtml(env: RunEnvelope, mailedCount: number, issuer: PhysicalInvoiceIssuer | null, docLabels: ReadonlyArray<string>): string {
  const ret = retLines(issuer)
  const lines = runAddressLines(env.address)
  const docs = runDocumentWords(docLabels)
  const cert =
    env.method === 'certified_mail'
      ? '<div class="cert">CERTIFIED MAIL · RETURN RECEIPT REQUESTED<span>Article no. ____ ____ ____ ____ ____</span></div>'
      : env.method === 'traceable_courier'
        ? '<div class="cert">TRACEABLE COURIER<span>Tracking no. ______________________</span></div>'
        : env.method === 'hand'
          ? '<div class="cert">HAND DELIVERED</div>'
          : '<div class="cert">BY EMAIL<span>' + esc(env.email) + '</span></div>'
  const inside = env.contents.map((c) => `${c.notice.label} · ${c.notice.months.length ? '' : ''}${demandMoney(String(c.notice.amount))}`).join(' · ')
  return (
    `<div class="rundiv" data-run-divider="${env.n}">` +
    `<div class="band"></div>` +
    `<div class="face"><div class="ret">${ret.map(esc).join('<br>')}</div>${cert}` +
    `<div class="to"><strong>${esc(env.name || '—')}</strong>${lines.length ? '<br>' + lines.map(esc).join('<br>') : ''}</div>` +
    `<div class="facen">Envelope ${env.n} of ${mailedCount} · ${esc(env.label)}</div></div>` +
    `<div class="big"><span class="num">${env.n}</span><span class="of">of ${mailedCount} ${mailedCount === 1 ? 'envelope' : 'envelopes'}</span></div>` +
    `<div class="meta"><div><b>${docs.count} ${docs.count === 1 ? 'document follows' : 'documents follow'} this page</b> · ${esc(docs.words.replace(/^[^·]*· /, ''))}. ${env.n === mailedCount ? 'This is the last envelope.' : `The next divider is envelope ${env.n + 1}.`}</div>` +
    `<div>Inside: ${env.contents.length > 1 ? `<b>${env.contents.length} notices</b> · ` : ''}${esc(inside)}</div></div>` +
    `<div class="ticks"><span>☐ ${docs.count} ${docs.count === 1 ? 'document' : 'documents'} counted</span><span>☐ sealed · slip on</span><span>☐ mailed</span></div>` +
    `<div class="trkline"><span class="lab">Tracking number</span><span class="box"><small>${env.method === 'certified_mail' ? '20 digits from the green slip' : env.method === 'hand' ? 'who signed for it' : 'the carrier’s number'}</small></span></div>` +
    `<div class="divfoot">Pull this page out before you seal. The face above is the envelope as the printer prints it, so you match them by eye. Pin this page to the sheet when the number is on it.</div>` +
    `<div class="runfoot"><span>Divider · envelope ${env.n} of ${mailedCount} · ${esc(env.name)}</span><span>stays on the desk</span></div>` +
    `</div>`
  )
}

/**
 * The foot of a page that goes in the envelope: the job, whose copy it is, what the document is
 * and its place in the copy — so a loose sheet finds its envelope. The run's own count stays off
 * the paper the recipient reads.
 */
export function runPageFoot(n: Pick<RunNotice, 'jobNumber'>, r: Pick<RunRecipient, 'label'>, label: string, index1: number, total: number): string {
  return `<div class="runfoot" data-run-page-foot><span><b>Job #${esc(n.jobNumber)}</b> · copy for the ${esc(r.label.toLowerCase())}</span><span>${esc(label)} · ${index1} of ${total}</span></div>`
}

/** The print shell's styles for the sheet, the divider and the foot. Letter paper; serif like the papers around it. */
export const RUN_PAPER_CSS = `
  @page { size: Letter; }
  .runfoot { display: flex; justify-content: space-between; gap: 1rem; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.68rem; color: #666; border-top: 1px dashed #bbb; padding-top: 4px; margin-top: 1.4rem; }
  .runfoot b { color: #1a1a1a; }
  .runsheet .hdr { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #bbb; padding-bottom: 4px; margin-bottom: 10px; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.72rem; color: #555; text-align: right; }
  .runsheet .hdr .co { font-family: Georgia, serif; font-size: 1.1rem; font-weight: 700; color: #1a1a1a; text-align: left; }
  .runsheet h1 { font-size: 1.35rem; margin: 2px 0 8px; font-weight: 700; }
  .runsheet h1 span { font-size: 0.85rem; font-weight: 400; color: #555; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  .runsheet .toyou { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.8rem; background: #f5f5f0; border: 1px solid #ccc; border-radius: 4px; padding: 7px 9px; margin: 0 0 10px; line-height: 1.4; }
  .runsheet table { width: 100%; border-collapse: collapse; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.74rem; line-height: 1.35; }
  .runsheet thead { display: table-header-group; }
  .runsheet th { text-align: left; font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; color: #555; border-bottom: 1.2px solid #1a1a1a; padding: 3px 6px 3px 0; }
  .runsheet td { padding: 6px 6px 2px 0; vertical-align: top; }
  .runsheet tr.runrow { break-inside: avoid; page-break-inside: avoid; }
  .runsheet tr.runtrk { break-inside: avoid; page-break-inside: avoid; }
  .runsheet td.n { font-family: Georgia, serif; font-size: 1.4rem; font-weight: 700; width: 1.6rem; line-height: 1; padding-top: 5px; }
  .runsheet td.to { width: 34%; }
  .runsheet td.to strong { display: block; font-size: 0.84rem; }
  .runsheet td.to small { display: block; color: #444; font-size: 0.72rem; line-height: 1.3; }
  .runsheet td.to small.why { color: #b91c1c; margin-top: 2px; }
  .runsheet td.in { color: #555; }
  .runsheet td.in b { color: #1a1a1a; }
  .runsheet td.done { width: 4.2rem; white-space: nowrap; line-height: 1.5; }
  .runsheet td.done span { display: block; }
  .runsheet tr.runtrk td { padding: 2px 0 7px; border-bottom: 1px solid #ccc; }
  .runsheet tr.runtrk div { display: flex; align-items: center; gap: 8px; }
  .runsheet tr.held td { background: #fdecec; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
  .runsheet tr.held td.to strong, .runsheet tr.held td.in b { color: #b91c1c; }
  .runsheet .runsheetfoot { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.68rem; color: #666; border-top: 1px dashed #bbb; padding-top: 4px; margin-top: 10px; }
  .lab { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; color: #555; white-space: nowrap; }
  .box { flex: 1 1 auto; display: block; border: 1.4px solid #1a1a1a; border-radius: 3px; height: 1.8rem; position: relative; }
  .box small { position: absolute; left: 6px; bottom: 2px; font-size: 0.55rem; color: #888; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  .rundiv .band { height: 16px; background: #111; margin: 0 0 14px; }
  .rundiv .face { position: relative; border: 1px solid #999; height: 3.1in; padding: 10px 12px; margin-bottom: 12px; }
  .rundiv .face .ret { font-size: 0.78rem; line-height: 1.3; }
  .rundiv .face .cert { margin-top: 0.3in; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; }
  .rundiv .face .cert span { display: block; font-weight: 400; letter-spacing: 0; color: #444; margin-top: 2px; }
  .rundiv .face .to { position: absolute; left: 44%; top: 1.35in; font-size: 1rem; line-height: 1.35; }
  .rundiv .face .to strong { font-size: 1.1rem; }
  .rundiv .face .facen { position: absolute; right: 8px; bottom: 5px; font-size: 0.64rem; color: #666; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  .rundiv .big { display: flex; align-items: baseline; gap: 12px; }
  .rundiv .big .num { font-size: 3.6rem; font-weight: 700; line-height: 1; }
  .rundiv .big .of { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.95rem; color: #555; }
  .rundiv .meta { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.82rem; color: #444; display: grid; gap: 3px; margin: 8px 0 12px; line-height: 1.4; }
  .rundiv .meta b { color: #1a1a1a; }
  .rundiv .ticks { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.88rem; display: flex; gap: 18px; }
  .rundiv .trkline { display: flex; align-items: center; gap: 8px; margin: 10px 0 12px; }
  .rundiv .trkline .box { height: 2.3rem; }
  .rundiv .divfoot { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 0.74rem; color: #555; border-top: 1px solid #ccc; padding-top: 6px; margin-top: 14px; }
`
