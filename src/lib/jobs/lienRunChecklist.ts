import { batchWords, countedLabel, type BatchNoun, type BatchHeldWhy, type BatchWords } from '../batchWords'
import { recipientMailed, recipientViaDocsmit, RUN_UNSIGNED_PROBLEM, runNoticeProblems, type RunNotice, type RunRecipient, type RunSendMethod } from './lienDeskRun'
import { shortDay } from './lienFootChip'
import { APP_ORIGIN } from '../appOrigin'
import { LIEN_DESK_PATH } from '../lien/lienDeskRoute'
import type { LienMailedCopy } from './lienMailedCopies'

/**
 * The run as a checklist (v2.7328, the owner's ask of 2026-11-15): one row per envelope's notice
 * with three ticks across — Printed, Signed, Mailed — each read from a fact the desk already
 * keeps. Printed is the item's `printed_at` / `printed_by` (or the print in this sitting), Signed
 * is the leader's signature on the item (his typed name at approval, his drawing, his code, or the
 * pen record the office wrote), Mailed is the tracking number typed for every paper envelope the
 * notice is in. Nothing new is recorded: the row says which tick it waits on, the batch presses
 * say how many they take and why the rest stay (`batchWords`), the pill on the desk reads the
 * run's count, and the pile row's line names the tick it waits on. Pure; the modal draws it.
 */

export type LienRunTickPrinted = { at: string; by: string | null }
export type LienRunTickSigned = { how: 'typed' | 'pen'; at: string; by: string }
export type LienRunTickMailed = { tracking: string; sentOn: string | null }

export type LienRunWaitsOn = 'print' | 'sign' | 'mail' | null

export type LienRunRecipientCell = {
  key: RunRecipient['key']
  /** 'Owner of record' / 'Original contractor' */
  label: string
  name: string
  method: RunSendMethod
  tracking: string
  /** Its number typed, or it goes by email, by hand or through Docsmit. */
  mailed: boolean
  /** The paper route: a Docsmit or email copy has no box to fill. */
  needsNumber: boolean
  /** The certified receipt added for this copy's envelope (v2.7695); '' when none. */
  receiptUrl: string
}

export type LienRunRow = {
  itemId: string
  jobId: string
  jobNumber: string
  /** "650 · AXO Schertz" */
  label: string
  /** The property's street, when the job's name does not say it (v2.7489); '' = none. */
  street: string
  recipients: LienRunRecipientCell[]
  amount: number
  printed: LienRunTickPrinted | null
  /** `not_needed` when the builder said nothing about signing (an older run entry). */
  signed: LienRunTickSigned | null | 'not_needed'
  mailed: LienRunTickMailed | null
  /** The first open tick in the order the owner works: print, then sign, then mail. Null once every tick is in. */
  waitsOn: LienRunWaitsOn
  /** The pile row's line: "printed · not signed", "signed · not mailed", "mailed · ready to record". */
  line: string
  /** The run's own hold on the notice — nothing to claim, no mailing address, the owner unconfirmed — or null. The Signed wait is a tick, not a hold. */
  held: string | null
  /** The job owes nothing now (v2.7337): the hold no tick can lift. No batch press takes the row, and its own Signed and Mailed are closed. */
  nothingToClaim: boolean
  /** The job's leader, for the pen pane; null when the builder named none. */
  leader: { userId: string | null; name: string } | null
  /** Every recipient goes by email or through Docsmit: nothing prints here. */
  paperless: boolean
  /** The scans or photos of what went in the envelope, oldest first (`lienMailedCopies.ts`); empty when none was added. */
  mailedCopies: LienMailedCopy[]
}

export type LienRunChecklistInput = {
  notices: ReadonlyArray<RunNotice>
  /** Printed in this sitting — by the print press or the Printed tick — when and by whom; wins over the row's stamp. */
  printedNow?: ReadonlyMap<string, LienRunTickPrinted>
}

/** The day a tick carries: "Nov 15". */
export function lienRunTickDay(iso: string | null | undefined): string {
  return shortDay(iso)
}

/** The pile row's line and the desk's words for a notice in the run, from the three facts alone. */
export function lienRunRowLine(printed: boolean, signed: boolean | 'not_needed', mailed: boolean): string {
  if (!printed) return 'not printed'
  if (signed === false) return 'printed · not signed'
  if (!mailed) return signed === 'not_needed' ? 'printed · not mailed' : 'signed · not mailed'
  return 'mailed · ready to record'
}

function recipientCell(r: RunRecipient): LienRunRecipientCell {
  const viaDocsmit = recipientViaDocsmit(r)
  return {
    key: r.key,
    label: r.label,
    name: r.name,
    method: r.method,
    tracking: r.tracking,
    mailed: recipientMailed(r),
    needsNumber: !viaDocsmit && r.method !== 'email',
    receiptUrl: (r.receiptUrl ?? '').trim(),
  }
}

/**
 * The hold on a notice whose job owes nothing now (v2.7337), or null. The run's amount is the job's
 * open balance as the desk reads it today, so a notice that printed with a claim and was paid since
 * lands here: the words name what the paper says beside what is owed. The rule is the envelope's
 * (`runEnvelopeHold`), read per notice, so the row and its envelope card agree.
 */
export function lienRunNothingToClaim(n: Pick<RunNotice, 'amount' | 'fields' | 'printedAt'>): string | null {
  if (Number(n.amount) > 0.005) return null
  const paper = Number(n.fields?.claimAmount)
  const says = n.printedAt && Number.isFinite(paper) && paper > 0.005 ? ` The paper says $${Math.round(paper).toLocaleString('en-US')}.` : ''
  return `Nothing to claim: the job owes $0 now.${says}`
}

/** One row per notice in the run, in the run's order. */
export function lienRunChecklistRows(input: LienRunChecklistInput): LienRunRow[] {
  return input.notices.map((n) => {
    const now = input.printedNow?.get(n.itemId) ?? null
    const printed: LienRunTickPrinted | null = now ?? (n.printedAt ? { at: n.printedAt, by: n.printedBy ?? null } : null)
    const sig = n.signature
    const signed: LienRunRow['signed'] = sig === undefined ? 'not_needed' : sig === null ? null : { how: sig.mode === 'pen' ? 'pen' : 'typed', at: sig.signedAtIso, by: sig.mode === 'pen' ? (sig.pen?.recordedByName ?? sig.printedName) : sig.printedName }
    const recipients = n.recipients.map(recipientCell)
    const paperless = recipients.length > 0 && recipients.every((r) => !r.needsNumber)
    const numbers = recipients.filter((r) => r.needsNumber && r.tracking.trim()).map((r) => r.tracking.trim())
    const everyMailed = recipients.length > 0 && recipients.every((r) => r.mailed)
    const mailed: LienRunTickMailed | null = everyMailed ? { tracking: numbers.join(' · ') || (paperless ? 'by email' : 'by hand'), sentOn: null } : null
    // The run's holds, less the signature: Signed is a tick here, never a red hold. Nothing to claim comes first: an address can be fixed, a paid job cannot be put on notice.
    const nothing = lienRunNothingToClaim(n)
    const held = nothing ?? runNoticeProblems(n).filter((p) => p !== RUN_UNSIGNED_PROBLEM)[0] ?? null
    const printedOk = printed != null || paperless
    const waitsOn: LienRunWaitsOn = !printedOk ? 'print' : signed === null ? 'sign' : !mailed ? 'mail' : null
    return {
      itemId: n.itemId,
      jobId: n.jobId,
      jobNumber: n.jobNumber,
      label: n.label,
      street: (n.street ?? '').trim(),
      recipients,
      amount: n.amount,
      printed,
      signed,
      mailed,
      waitsOn,
      line: lienRunRowLine(printedOk, signed === 'not_needed' ? 'not_needed' : signed !== null, mailed != null),
      held,
      nothingToClaim: nothing != null,
      leader: n.leader ?? null,
      paperless,
      mailedCopies: n.mailedCopies ?? [],
    }
  })
}

/**
 * The row's four steps in the order they are done (v2.7695, the owner's yes to the mail proof mock-ups): each step is
 * a cell with its own press, so the file that goes in the envelope has a place of its own between Signed and Mailed.
 */
export const LIEN_RUN_STEP_WORDS = {
  printed: '1 · Printed',
  signed: '2 · Signed',
  envelope: '3 · In the envelope',
  mailed: '4 · Mailed',
  next: 'Next:',
  ready: 'Ready to record.',
} as const

const COPY_SHORT: Record<string, string> = { owner: 'owner', original_contractor: 'GC' }

/**
 * The one thing to do next on a row, as a sentence; null on a row the run holds or that owes nothing, whose own line
 * says why. The signature and the print, then the file that goes in the envelope, then each envelope's number and receipt. A
 * receipt is asked for, never required: a row with every number typed reads *Ready to record.* once its receipts
 * are in, and records without them.
 */
export function lienRunRowNext(row: LienRunRow, opts: { canAddCopy: boolean; canAddReceipt: boolean } = { canAddCopy: true, canAddReceipt: true }): string | null {
  if (row.held || row.nothingToClaim) return null
  // An unsigned notice is signed from a phone before it prints, or printed by hand for a pen: the signature is what it waits on either way.
  if (row.signed === null) {
    if (!row.leader?.name) return 'Name a leader on the job to sign it.'
    return row.waitsOn === 'print' ? `Get ${row.leader.name}’s signature, or print it for a pen.` : `Get ${row.leader.name}’s signature.`
  }
  if (row.waitsOn === 'print') return 'Print the notice.'
  if (row.paperless) return row.waitsOn === 'mail' ? 'Record it. The app sends the email.' : LIEN_RUN_STEP_WORDS.ready
  if (opts.canAddCopy && row.mailedCopies.length === 0) return 'Scan what goes in the envelope and add the file.'
  const boxes = row.recipients.filter((r) => r.needsNumber)
  const noNumber = boxes.find((r) => !r.tracking.trim())
  if (noNumber) return opts.canAddReceipt && !noNumber.receiptUrl ? `Add the ${COPY_SHORT[noNumber.key] ?? noNumber.key}’s receipt. The number fills in from a photo.` : `Type the ${COPY_SHORT[noNumber.key] ?? noNumber.key}’s mail number.`
  const noReceipt = opts.canAddReceipt ? boxes.find((r) => !r.receiptUrl) : undefined
  if (noReceipt) return `Add the ${COPY_SHORT[noReceipt.key] ?? noReceipt.key}’s receipt.`
  return LIEN_RUN_STEP_WORDS.ready
}

export type LienRunHeldRow = { itemId: string; label: string; why: string }

export type LienRunBatchPlan = {
  /** The rows the press takes, in run order. */
  ready: LienRunRow[]
  /** The rows it leaves, each with its reason. A row already past the tick is neither. */
  held: LienRunHeldRow[]
  words: BatchWords
}

export type LienRunBatchPlans = { print: LienRunBatchPlan; sign: LienRunBatchPlan; mail: LienRunBatchPlan }

/**
 * What each batch press would do: Mark N printed takes the unprinted paper rows the run does not
 * hold; Mark N signed takes the printed, unsigned rows of one leader (the first in the run; the
 * pen pane names one signer) and holds the rest with why; Record N mailings takes the printed rows
 * whose every envelope has its number, and holds the ones still owing a print or a number. A row
 * with nothing to claim (v2.7337) is held from all three, and never picks the signer.
 */
export function lienRunBatchPlans(rows: ReadonlyArray<LienRunRow>): LienRunBatchPlans {
  const printReady: LienRunRow[] = []
  const printHeld: LienRunHeldRow[] = []
  for (const r of rows) {
    if (r.printed || r.paperless) continue
    if (r.held) printHeld.push({ itemId: r.itemId, label: r.label, why: r.held })
    else printReady.push(r)
  }
  const signReady: LienRunRow[] = []
  const signHeld: LienRunHeldRow[] = []
  const unsigned = rows.filter((r) => r.signed === null)
  const firstLeader = unsigned.find((r) => !r.nothingToClaim && (r.printed || r.paperless))?.leader ?? null
  for (const r of unsigned) {
    if (r.nothingToClaim) signHeld.push({ itemId: r.itemId, label: r.label, why: r.held ?? 'nothing to claim' })
    else if (!r.printed && !r.paperless) signHeld.push({ itemId: r.itemId, label: r.label, why: 'not printed yet' })
    else if (!r.leader?.name) signHeld.push({ itemId: r.itemId, label: r.label, why: 'the job has no leader to name' })
    else if (firstLeader && r.leader.userId !== firstLeader.userId) signHeld.push({ itemId: r.itemId, label: r.label, why: `${r.leader.name}’s, on the next press` })
    else signReady.push(r)
  }
  const mailReady: LienRunRow[] = []
  const mailHeld: LienRunHeldRow[] = []
  for (const r of rows) {
    if (r.held) mailHeld.push({ itemId: r.itemId, label: r.label, why: r.held })
    else if (!r.printed && !r.paperless) mailHeld.push({ itemId: r.itemId, label: r.label, why: 'not printed yet' })
    else if (!r.mailed) mailHeld.push({ itemId: r.itemId, label: r.label, why: r.recipients.filter((x) => x.needsNumber && !x.mailed).length > 1 ? 'no tracking numbers yet' : 'no tracking number yet' })
    else mailReady.push(r)
  }
  return {
    print: { ready: printReady, held: printHeld, words: words('Mark', printReady.length, printHeld.length, 'held', ['printed', 'printed']) },
    sign: { ready: signReady, held: signHeld, words: words('Mark', signReady.length, signHeld.length, { one: 'waits', many: 'wait' }, ['signed', 'signed']) },
    mail: { ready: mailReady, held: mailHeld, words: words('Record', mailReady.length, mailHeld.length, { one: 'waits', many: 'wait' }, 'mailing') },
  }
}

/**
 * `batchWords`, and with nothing ready the dead button keeps its noun (*Mark printed*), as `countedLabel` reads at zero.
 * Since v2.7477 that holds with rows held too: the two Mark presses sit side by side under More, and both read *Mark ▸*.
 */
function words(verb: string, ready: number, held: number, heldWhy: BatchHeldWhy, noun: BatchNoun): BatchWords {
  const w = batchWords({ verb, ready, held, heldWhy, noun })
  return ready === 0 ? { ...w, button: countedLabel(verb, 0, noun) } : w
}

/** The address a sheet's code opens: the desk with the run open on this envelope's Mailed box. */
export function lienRunMailLink(itemId: string, origin: string = APP_ORIGIN): string {
  return `${origin}${LIEN_DESK_PATH}?run=${encodeURIComponent(itemId)}&mail=1`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type LienRunSheetInput = {
  rows: ReadonlyArray<LienRunRow>
  todayYmd: string
  /** The day as the sheet's head reads it. */
  dayWords: string
  issuerName: string
  /** A row's code as markup (an image), or '' for none. */
  codeFor: (itemId: string) => string
}

/**
 * The sheet (v2.7328): one page per batch — a row per notice with its label, who it goes to and the
 * amount, three boxes (a tick drawn in when the desk already holds the fact, with who and when) and
 * a code that opens that envelope's Mailed box on a phone. It is a desk paper, not a sent copy.
 */
export function lienRunSheetHtml(i: LienRunSheetInput): string {
  const box = (done: boolean, words: string) => `<span class="bx${done ? ' on' : ''}">${done ? '☑' : '☐'} ${esc(words)}</span>`
  const row = (r: LienRunRow, n: number) => {
    const who = r.recipients.map((x) => `${x.key === 'owner' ? 'Owner' : 'GC'}: ${x.name || '—'}`).join(' · ')
    const printedWords = r.printed ? `Printed ${lienRunTickDay(r.printed.at)}${r.printed.by ? ` · ${r.printed.by}` : ''}` : r.paperless ? 'Printed · by email' : 'Printed'
    const signedWords = r.signed === 'not_needed' ? 'Signed' : r.signed ? `Signed ${lienRunTickDay(r.signed.at)} · ${r.signed.how === 'pen' ? 'pen' : 'typed'}` : 'Signed'
    const mailedWords = r.mailed ? `Mailed · ${r.mailed.tracking}` : 'Mailed'
    return (
      `<tr data-run-sheet-row="${esc(r.itemId)}"${r.held ? ' class="held"' : ''}>` +
      `<td class="n">${n}</td>` +
      `<td class="who"><strong>${esc(r.label)}</strong><small>${esc(who)}</small>${r.held ? `<small class="why">${esc(r.held)}</small>` : ''}</td>` +
      `<td class="amt">$${Math.round(r.amount).toLocaleString('en-US')}</td>` +
      `<td class="ticks">${box(r.printed != null || r.paperless, printedWords)}${box(r.signed !== null, signedWords)}${box(r.mailed != null, mailedWords)}</td>` +
      `<td class="code">${i.codeFor(r.itemId)}</td>` +
      `</tr>`
    )
  }
  return (
    `<div class="runchecklist" data-run-checklist-sheet>` +
    `<h1>The run <span>· ${i.rows.length} ${i.rows.length === 1 ? 'notice' : 'notices'} · ${esc(i.dayWords)}</span></h1>` +
    `<p class="toyou">${esc(i.issuerName)}. Tick each box as you go: printed, signed, mailed. Scan a row’s code with your phone to type that envelope’s number into the desk. This sheet stays on the desk; it is not a copy of anything sent.</p>` +
    `<table><thead><tr><th class="n">#</th><th>Notice</th><th class="amt">Amount</th><th>Printed · Signed · Mailed</th><th class="code">Scan to record</th></tr></thead><tbody>` +
    i.rows.map(row).join('') +
    `</tbody></table>` +
    `</div>`
  )
}

export const LIEN_RUN_SHEET_CSS = `
.runchecklist { font: 10.5pt/1.35 Helvetica, Arial, sans-serif; color: #111; page-break-after: always; }
.runchecklist h1 { font-size: 18pt; margin: 0 0 4pt; }
.runchecklist h1 span { font-weight: 400; font-size: 11pt; color: #444; }
.runchecklist .toyou { margin: 0 0 10pt; color: #333; }
.runchecklist table { width: 100%; border-collapse: collapse; }
.runchecklist th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #555; border-bottom: 1.5pt solid #111; padding: 3pt 4pt; }
.runchecklist td { vertical-align: top; padding: 6pt 4pt; border-bottom: 0.75pt solid #999; }
.runchecklist td.n { width: 18pt; font-weight: 700; }
.runchecklist td.who small { display: block; color: #444; font-size: 8.5pt; }
.runchecklist td.who small.why { color: #b00020; font-weight: 700; }
.runchecklist td.amt, .runchecklist th.amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.runchecklist td.ticks .bx { display: block; white-space: nowrap; font-size: 10pt; }
.runchecklist td.ticks .bx.on { color: #0a6b2e; }
.runchecklist td.code, .runchecklist th.code { width: 64pt; text-align: center; }
.runchecklist td.code img { width: 56pt; height: 56pt; }
.runchecklist tr.held td { color: #777; }
`
