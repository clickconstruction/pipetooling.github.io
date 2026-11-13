import { demandDate, demandMoney } from '../jobsDocuments/demandLetter'
import { buildLienNoticeBlocks, filingDocHtml, type FilingDocExtras } from '../jobsDocuments/lienFilingDocuments'
import { LIEN_HELP_BATCH_ASK_LEAD, LIEN_HELP_FOOT_PAPER_NEXT, STRIPE, esc, foot } from './lienHelpSheet'
import { describeNoticeMonths } from './lienNoticeDraft'
import { lienNoticeRecordAsks, lienNoticeRecordDaysBetween, lienNoticeRecordMethodWords, type LienNoticeRecord, type LienNoticeRecordCopy, type LienNoticeRecordLine, type LienNoticeRecordNotice } from './lienNoticeRecord'

/**
 * The notice record as a printed page (punch list #322). Pure: the words and the HTML, nothing else.
 *
 * It prints with a short-form lien affidavit, in front of the paper, so the signer, the attorney and a teammate who
 * opens the file later can see what the paper's sentences 5 and 6 stand on: each notice mailed, each copy's day, method
 * and mail number, whether every sworn month has a notice on time, and the two sentences read against the record.
 * Behind it prints a copy of each notice. The owner saw the first draw, which had a table of the months with each
 * one's last day to mail, and said (2026-11-12): *I don't want to see this section of the notice, I want to see
 * copies of what was sent*. So the table is gone and the copies are here. Three shapes:
 *
 * - `lienNoticeRecordSheetHtml` — one page for one paper (the Lien window's **Print for notarization**);
 * - `lienNoticeCopiesHtml` — a page for each notice behind that page: its delivery record at the top (a big check,
 *   how many days ago it went, what went, and a line for each copy), then the notice drawn from the words its row
 *   keeps, with COPY across it;
 * - `lienNoticeRecordBatchHtml` — a block for each paper of a batch, packed several to a page and numbered as the
 *   batch sheet's rows are (the Lien desk's **Print N for notarization**). The blocks, and the copies when their box
 *   is ticked, sit in front of the stack with the batch sheet, never between two papers, so neither can ride to the
 *   clerk behind a paper.
 *
 * A copy is drawn from the record, and says so: it is the form's lines as the row holds them, without the invoices
 * that rode behind the notice. The page as it printed and the saved file live in the job's Documents and in Drive,
 * which a print cannot pull in; the page says where they are.
 *
 * Like a help sheet it is never the paper: it carries no sworn word, it is in no job's filed copy, its top edge is
 * striped, and every page says not to file it. It has its own tick box beside the print press
 * (`useLienNoticeRecordChoice`), because the help sheet teaches a signer and this is the proof a reviewer reads. The
 * styles ride on `LIEN_HELP_STYLES`; the few of its own are `LIEN_RECORD_STYLES`. The words follow `src/lib/plainWords.ts`.
 */

/** The job's facts across the top of a record, as the paper states them. */
export type LienNoticeRecordHead = {
  jobLabel: string
  propertyAddress: string
  /** The owner and the original contractor as the paper names them today. The record keeps who a copy went to, not the name on the envelope. */
  ownerName: string
  contractorName: string
  /** The amount the paper claims, in words (`$5,260.00`). Each notice's own amount is in its row. */
  claim: string
}

export const LIEN_RECORD_STYLES = `
  .lien-record-rows { margin-bottom: 3pt; }
  .lien-record-rows td.lien-record-none { font-weight: 800; }
  .lien-record-h { font-size: 9pt; margin: 5pt 0 2pt; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; }
  .lien-help ul.lien-record-lines { list-style: none; padding: 0; margin: 0; }
  .lien-help ul.lien-record-lines li { display: grid; grid-template-columns: 11pt 1fr; gap: 3pt; margin: 0 0 2pt; }
  .lien-record-block { break-inside: avoid; page-break-inside: avoid; padding: 4pt 6pt; margin-bottom: 4pt; }
  .lien-record-block-head { display: flex; justify-content: space-between; gap: 8pt; align-items: baseline; border-bottom: 1pt solid #111418; padding-bottom: 2pt; margin-bottom: 3pt; }
  .lien-record-block-head strong { white-space: nowrap; }
  .lien-record-block-head span { text-align: right; }
  .lien-record-paper { font-size: 8.5pt; line-height: 1.33; padding: 7pt 16pt; margin-bottom: 0; overflow: hidden; }
  .lien-record-sent { display: grid; grid-template-columns: 46pt 1fr; gap: 10pt; align-items: center; border: 2pt solid #111418; padding: 5pt 10pt; margin-bottom: 4pt; break-inside: avoid; page-break-inside: avoid; }
  .lien-record-sent-mark { width: 46pt; height: 46pt; display: flex; align-items: center; justify-content: center; background: #111418; color: #fff; font: 800 34pt system-ui, Arial, sans-serif; line-height: 1; }
  .lien-record-sent-ago { font-size: 17pt; font-weight: 800; line-height: 1.15; }
  .lien-record-sent-what { font-weight: 700; margin: 1pt 0 3pt; }
  .lien-help ul.lien-record-sent-lines { list-style: none; padding: 0; margin: 0; font-size: 9pt; }
  .lien-help ul.lien-record-sent-lines li { display: grid; grid-template-columns: 11pt 1fr; gap: 3pt; margin: 0 0 1pt; }
  .lien-record-code { display: flex; gap: 6pt; align-items: center; }
  .lien-record-code img { width: 38pt; height: 38pt; display: block; image-rendering: pixelated; }
  .lien-record-verdict { border: 0.75pt solid #8a9099; border-left-width: 3pt; padding: 2.5pt 7pt; margin: 4pt 0 0; break-inside: avoid; page-break-inside: avoid; }
  .lien-record-verdict[data-lien-record-verdict="ask"] { background: #e2e4e8; border-color: #6b727b; }
  .lien-record-verdict-lead { font-weight: 800; }
`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** `Sep 22, 2026`, for a table cell; the text as given when it is not a day. */
export function lienRecordDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '')
  const name = m ? MONTHS[Number(m[2]) - 1] : undefined
  return m && name ? `${name} ${Number(m[3])}, ${m[1]}` : (ymd ?? '')
}

/** At the foot of a record when every sworn month stands, after `LIEN_RECORD_ON`. */
export const LIEN_RECORD_CLEAR = 'Every month the paper swears has a notice mailed on time, to the owner and to the original contractor.'

/**
 * The lead of the box at a record's foot when a month does not stand: the batch sheet's own lead, so a row and its
 * block say it the same way (the owner, 2026-11-13). The notice check's short lines follow it
 * (`LienNoticeRecord.flagsShort`): they say which copy raised the question, which the row no longer says.
 */
export const LIEN_RECORD_ASK = LIEN_HELP_BATCH_ASK_LEAD

/** The lead of the same spot on a record that stands. */
export const LIEN_RECORD_ON = 'On record.'

/** Under the notices: what the record cannot say. */
export const LIEN_RECORD_ENVELOPE = 'The app keeps who each copy went to. It does not keep the address on the envelope.'

/** Under the list of what is missing: where it is added. */
export const LIEN_RECORD_FIX = 'Add what is missing in the job’s Lien window, under Filings on this job.'

/** Where nothing is missing. */
export const LIEN_RECORD_WHOLE = 'Nothing is missing. Each copy has its day and its mail number. Each notice has a saved copy.'

/** A paper with no notice on the job. */
export const LIEN_RECORD_NO_NOTICE = 'No § 53.056 notice is on record for this job.'

/** A batch block for a job contracted with the owner. */
export const LIEN_RECORD_NOT_SUB = 'This job was contracted with the owner. No monthly notice is owed, and the paper has no sentence about one.'

/** How many voided notices the page leaves out; '' with none. */
export function lienRecordVoidedWords(voided: number): string {
  return voided <= 0 ? '' : voided === 1 ? '1 voided notice on this job is not counted and is not shown.' : `${voided} voided notices on this job are not counted and are not shown.`
}

const COPY_TO: Record<LienNoticeRecordCopy['recipient'], string> = { owner: 'Owner', original_contractor: 'Original contractor' }

function numberCell(c: LienNoticeRecordCopy): string {
  const receipt = c.receipt ? '<br/><span class="lien-help-small">Receipt photo on file</span>' : ''
  if (c.number === 'held') return `${esc(c.tracking)}${receipt}`
  if (c.number === 'owed') return `<strong>No number on record</strong>${receipt}`
  if (c.number === 'coming') return `Coming from the mail provider${receipt}`
  return `None for this method${receipt}`
}

function copyRow(c: LienNoticeRecordCopy): string {
  if (!c.onRecord) return `<tr data-lien-record-copy="${c.recipient}" data-on-record="no"><td>${COPY_TO[c.recipient]}</td><td colspan="3" class="lien-record-none">No copy on record</td></tr>`
  return (
    `<tr data-lien-record-copy="${c.recipient}"><td>${COPY_TO[c.recipient]}</td>` +
    `<td>${c.sentOn ? esc(lienRecordDay(c.sentOn)) : '<strong>No day on record</strong>'}</td>` +
    `<td>${esc(lienNoticeRecordMethodWords(c.method))}</td>` +
    `<td>${numberCell(c)}</td></tr>`
  )
}

/** The first cell of the row that carries the office's own line on a notice's saved copy: a receipt, the day it was delivered. */
export const LIEN_RECORD_SAVED_NOTE = 'Note on the saved copy'

/** A notice whose saved copy is a note alone, with no file behind it. */
export const LIEN_RECORD_NOTE_ONLY = 'A note, no saved file'

/** A notice's own line above its copies: the months it named, its amount, when it was entered, and the saved copy. Its note has a row of its own. */
export function lienRecordNoticeWords(n: LienNoticeRecordNotice): string {
  const months = n.months.length > 0 ? `Names ${describeNoticeMonths(n.months)}` : 'Names no month'
  const claim = n.claim === null ? '' : n.printedClaim !== null ? `Claim ${demandMoney(n.printedClaim.toFixed(2))} on the paper, ${demandMoney(n.claim.toFixed(2))} for this job` : `Claim ${demandMoney(n.claim.toFixed(2))}`
  const entered = n.recordedOn ? `${n.byHand ? 'Entered after the fact' : 'Entered'} ${lienRecordDay(n.recordedOn)}` : n.byHand ? 'Entered after the fact' : ''
  const saved = n.savedCopy ? 'Saved copy on file' : n.savedNote ? LIEN_RECORD_NOTE_ONLY : 'No saved copy'
  return [months, claim, entered, saved].filter(Boolean).join(' · ')
}

/** Under a notice's copies: the line the office wrote beside its saved copy, whole. '' when it wrote none. */
function savedNoteRow(n: LienNoticeRecordNotice): string {
  return n.savedNote ? `<tr data-lien-record-saved-note="${n.n}"><td>${LIEN_RECORD_SAVED_NOTE}</td><td colspan="3">${esc(n.savedNote)}</td></tr>` : ''
}

function noticesTable(record: LienNoticeRecord): string {
  if (record.notices.length === 0) return `<p data-lien-record-no-notice><strong>${esc(LIEN_RECORD_NO_NOTICE)}</strong></p>`
  const rows = record.notices
    .map((n) => `<tr class="lien-help-group" data-lien-record-notice="${n.n}"><td colspan="4">Notice ${n.n} · ${esc(lienRecordNoticeWords(n))}</td></tr>${n.copies.map(copyRow).join('')}${savedNoteRow(n)}`)
    .join('')
  return (
    `<table class="lien-help-rows lien-record-rows" data-lien-record-notices><colgroup><col style="width:22%"/><col style="width:17%"/><col style="width:19%"/><col style="width:42%"/></colgroup>` +
    `<tr><th>Copy to</th><th>Day mailed</th><th>How</th><th>Mail number</th></tr>${rows}</table>`
  )
}

const LINE_MARK: Record<LienNoticeRecordLine['state'], string> = { ok: '✓', ask: '!', note: '•' }

function linesBox(record: LienNoticeRecord): string {
  return (
    `<div class="lien-help-box" data-lien-record-lines style="margin-bottom:0"><h3>The paper against the record</h3><ul class="lien-record-lines">` +
    record.lines.map((l) => `<li data-state="${l.state}"><span class="lien-help-mark">${LINE_MARK[l.state]}</span><span><strong>${esc(l.lead)}</strong> ${esc(l.words)}</span></li>`).join('') +
    `</ul></div>`
  )
}

function gapsBox(record: LienNoticeRecord): string {
  const voided = lienRecordVoidedWords(record.voided)
  const tail = voided ? `<p class="lien-help-small" style="margin-top:3pt" data-lien-record-voided>${esc(voided)}</p>` : ''
  if (record.gaps.length === 0) return `<div class="lien-help-box" data-lien-record-gaps="none" style="margin-bottom:0"><h3>Missing from the record</h3><p>${esc(record.notices.length > 0 ? LIEN_RECORD_WHOLE : LIEN_RECORD_NO_NOTICE)}</p>${tail}</div>`
  return (
    `<div class="lien-help-box" data-lien-record-gaps style="margin-bottom:0"><h3>Missing from the record</h3><ul>${record.gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` +
    `<p class="lien-help-small" style="margin-top:3pt">${esc(LIEN_RECORD_FIX)}</p>${tail}</div>`
  )
}

/** Both sentences match and nothing else is said: a batch block says so in one line. */
export const LIEN_RECORD_MATCH = 'Sentences 5 and 6 match the record.'

/** A batch block's closing lines: the two sentences in a line when they match, then what is beside them and what is missing. */
function compactClose(record: LienNoticeRecord): string {
  const sentences = record.lines.filter((l) => l.lead.startsWith('Sentence'))
  const match = sentences.length > 0 && sentences.every((l) => l.state === 'ok')
  const rest = record.lines.filter((l) => !(match && l.lead.startsWith('Sentence')))
  const voided = lienRecordVoidedWords(record.voided)
  const items = [
    ...(match ? [`<li data-state="ok"><span class="lien-help-mark">✓</span><span>${esc(LIEN_RECORD_MATCH)}${record.gaps.length === 0 && record.notices.length > 0 ? ' Nothing is missing from the record.' : ''}</span></li>`] : []),
    ...rest.map((l) => `<li data-state="${l.state}"><span class="lien-help-mark">${LINE_MARK[l.state]}</span><span><strong>${esc(l.lead)}</strong> ${esc(l.words)}</span></li>`),
    ...record.gaps.map((g) => `<li data-lien-record-gap><span class="lien-help-mark">○</span><span><strong>Missing.</strong> ${esc(g)}</span></li>`),
    ...(voided ? [`<li data-lien-record-voided><span class="lien-help-mark">•</span><span>${esc(voided)}</span></li>`] : []),
  ]
  return `<ul class="lien-record-lines lien-help-small" data-lien-record-close style="margin-top:3pt">${items.join('')}</ul>`
}

/**
 * The box that closes a record: what the facts above it add up to. It sits at the foot, after the table and the
 * lines, and is drawn in grey (the owner, 2026-11-13, on a heavy black box above the table: *move the box to the
 * bottom of the section, make it less black and more gray*). The facts come first and the question about them closes
 * the block. A record that stands has its line in the same spot and the same family, with no fill, so a reader finds
 * one place on every block. The fill and the wider left edge are what set a question apart on a black-and-white print.
 * The lead stays in the page's own ink: grey words break up under a laser's screen, and a grey band does not.
 */
function verdict(record: LienNoticeRecord): string {
  if (!lienNoticeRecordAsks(record)) return `<div class="lien-record-verdict" data-lien-record-verdict="clear"><span class="lien-record-verdict-lead">${esc(LIEN_RECORD_ON)}</span> ${esc(LIEN_RECORD_CLEAR)}</div>`
  const words = record.flagsShort.length > 0 ? record.flagsShort.join(' ') : record.flags.length > 0 ? record.flags.join(' ') : record.lines.filter((l) => l.state === 'ask').map((l) => `${l.lead} ${l.words}`).join(' ')
  return `<div class="lien-record-verdict" data-lien-record-verdict="ask"><span class="lien-record-verdict-lead">${esc(LIEN_RECORD_ASK)}</span> ${esc(words)}</div>`
}

/** Everything under a record's head: the notices, the two sentences against them, what is missing, and the verdict last. One body for both shapes, so a batch block and a single page cannot disagree. */
function recordBody(record: LienNoticeRecord, compact = false): string {
  // A batch block (`compact`) says the envelope line and where to add what is missing once, above the blocks.
  if (compact) return noticesTable(record) + compactClose(record) + verdict(record)
  return (
    `<div class="lien-record-h" style="margin-top:0">The notices on record</div>` +
    noticesTable(record) +
    (record.notices.length > 0 ? `<p class="lien-help-small">${esc(LIEN_RECORD_ENVELOPE)}</p>` : '') +
    `<div class="lien-help-two" style="margin-top:5pt">${linesBox(record)}${gapsBox(record)}</div>` +
    verdict(record)
  )
}

/**
 * What the caller hands a record page: a code that opens the job's Lien window, where the saved copies and the
 * receipts are, and how many copies of notices print behind it, so its foot says what the next page is.
 */
export type LienNoticeRecordExtras = { jobCode?: string; copiesFollow?: number }

/** The foot's right side on the page in front of the copies. */
export function lienRecordFootNext(copiesFollow: number): string {
  return copiesFollow <= 0 ? LIEN_HELP_FOOT_PAPER_NEXT : copiesFollow === 1 ? 'A copy of the notice is next, then the paper to sign' : 'Copies of the notices are next, then the paper to sign'
}

const recordBand = (tag: string, title: string, right: string[], code = ''): string =>
  `<div class="lien-help-band"><div><div class="lien-help-tag">${esc(tag)}</div><h2>${esc(title)}</h2></div>` +
  `<div class="lien-record-code"><div class="lien-help-small" style="text-align:right">${[...right.filter(Boolean), code ? 'Scan to open the job’s filings' : ''].filter(Boolean).map(esc).join('<br/>')}</div>${code ? `<span data-lien-record-code>${code}</span>` : ''}</div></div>`

/** One page in front of one paper: the job, then the record behind the paper's sentences 5 and 6. */
export function lienNoticeRecordSheetHtml(head: LienNoticeRecordHead, record: LienNoticeRecord, printedOn: string, extras?: LienNoticeRecordExtras): string {
  return (
    `<section class="lien-help" data-lien-help="record">` +
    STRIPE +
    recordBand('Notice record · do not file this page', 'What was mailed before this affidavit', [printedOn ? `Printed ${printedOn}` : '', 'Stays with the job'], extras?.jobCode) +
    `<div class="lien-help-facts" style="grid-template-columns:1.1fr 1.3fr 1fr 1fr 0.8fr">` +
    `<div><div class="lien-help-k">Job</div><div class="lien-help-v">${esc(head.jobLabel)}</div></div>` +
    `<div><div class="lien-help-k">Property</div><div class="lien-help-v">${esc(head.propertyAddress)}</div></div>` +
    `<div><div class="lien-help-k">Owner</div><div class="lien-help-v">${esc(head.ownerName.trim() || 'not on the paper')}</div></div>` +
    `<div><div class="lien-help-k">Original contractor</div><div class="lien-help-v">${esc(head.contractorName.trim() || 'not on the paper')}</div></div>` +
    `<div><div class="lien-help-k">The paper claims</div><div class="lien-help-v">${esc(head.claim)}</div></div>` +
    `</div>` +
    recordBody(record) +
    foot(`Notice record for ${head.jobLabel}`, lienRecordFootNext(extras?.copiesFollow ?? 0)) +
    `</section>`
  )
}

/** One paper of a batch: its head, and its record; a null record is a job contracted with the owner. */
export type LienNoticeRecordBatchPaper = { head: LienNoticeRecordHead; record: LienNoticeRecord | null }

/** Under the batch's band: how to read the blocks. */
export const LIEN_RECORD_BATCH_LEAD = 'One block for each paper, in the order of the stack. The number is the paper’s row on the batch sheet.'

/**
 * A block for each paper of a batch, packed several to a page. '' when the batch has no paper. A block never breaks
 * across two pages, and the section ends its own page, so the first paper starts a fresh sheet.
 */
export function lienNoticeRecordBatchHtml(papers: ReadonlyArray<LienNoticeRecordBatchPaper>, printedOn: string, copiesFollow = false): string {
  if (papers.length === 0) return ''
  const asks = papers.filter((p) => p.record && lienNoticeRecordAsks(p.record)).length
  const blocks = papers
    .map((p, i) => {
      const who = [p.head.propertyAddress.trim(), p.head.ownerName.trim() ? `Owner ${p.head.ownerName.trim()}` : '', p.head.contractorName.trim() ? `Contractor ${p.head.contractorName.trim()}` : '', p.head.claim.trim() ? `The paper claims ${p.head.claim.trim()}` : ''].filter(Boolean).map(esc).join(' · ')
      return (
        `<div class="lien-help-box lien-record-block" data-lien-record-paper="${i + 1}">` +
        `<div class="lien-record-block-head"><strong>${i + 1} · ${esc(p.head.jobLabel)}</strong><span class="lien-help-small">${who}</span></div>` +
        (p.record ? recordBody(p.record, true) : `<p data-lien-record-not-sub>${esc(LIEN_RECORD_NOT_SUB)}</p>`) +
        `</div>`
      )
    })
    .join('')
  const count = papers.length
  return (
    `<section class="lien-help" data-lien-help="records">` +
    STRIPE +
    recordBand('Notice records · do not file these pages', count === 1 ? 'What was mailed before this affidavit' : `What was mailed before each of ${count} affidavits`, [printedOn ? `Printed ${printedOn}` : '', asks === 0 ? '' : asks === 1 ? '1 waits for the attorney' : `${asks} wait for the attorney`]) +
    `<p class="lien-help-small" style="margin-bottom:5pt" data-lien-record-batch-lead>${esc(LIEN_RECORD_BATCH_LEAD)} ${esc(LIEN_RECORD_ENVELOPE)} ${esc(LIEN_RECORD_FIX)}</p>` +
    blocks +
    foot(`Notice records for the batch${printedOn ? ` printed ${printedOn}` : ''}`, copiesFollow ? (count === 1 ? 'Copies of its notices are next, then 1 paper' : `Copies of the notices are next, then ${count} papers`) : count === 1 ? '1 paper follows these pages' : `${count} papers follow these pages`) +
    `</section>`
  )
}

/** The word across a copy of a notice: plain enough that nobody mails or files the page. */
export const LIEN_RECORD_COPY_WATERMARK = 'COPY'

/** Above a copy: what the page is drawn from, and what it leaves out. */
export const LIEN_RECORD_COPY_DRAWN = 'This page is drawn from the app’s record of the notice. The invoices that went with it are not shown.'

/** Above a copy of a notice the office entered after it went out by hand. */
export const LIEN_RECORD_COPY_BY_HAND = 'This notice was entered after it was mailed. The paper that went is the saved copy, under Filings on this job.'
export const LIEN_RECORD_COPY_BY_HAND_NO_FILE = 'This notice was entered after it was mailed. The app has no saved copy of the paper that went.'
export const LIEN_RECORD_COPY_BY_HAND_NOTE = 'This notice was entered after it was mailed. The app has a note on the paper that went, and no file.'

/** Above a copy whose mailed paper was saved to the job. */
export const LIEN_RECORD_COPY_SAVED = 'The saved copy of the mailed paper opens from the job’s Lien window, under Filings on this job.'

/** One copy's line under a redrawn notice, as the Filings list's own view writes it: who, how, the number, the day. */
export function lienRecordDeliveryLine(c: LienNoticeRecordCopy): string {
  const to = c.recipient === 'owner' ? 'Owner of record' : 'Original contractor'
  if (!c.onRecord) return `${to} — no copy on record`
  return `${to} — ${lienNoticeRecordMethodWords(c.method).toLowerCase()}${c.tracking ? ` · ${c.tracking}` : c.number === 'owed' ? ' · no number on record' : ''}${c.sentOn ? ` · ${demandDate(c.sentOn)}` : ''}`
}

/** How long ago a notice went, in the words a reader sees first: `Sent 51 days ago`. `first` when its copies went on different days. */
export function lienRecordSentAgoWords(mailedYmd: string, todayYmd: string | null | undefined, first = false): string {
  const lead = first ? 'First copy sent' : 'Sent'
  if (!mailedYmd) return 'No day mailed on record'
  const today = (todayYmd ?? '').trim()
  const days = today ? lienNoticeRecordDaysBetween(mailedYmd, today) : -1
  if (!today || days < 0) return `${lead} ${demandDate(mailedYmd)}`
  return days === 0 ? `${lead} today` : days === 1 ? `${lead} 1 day ago` : `${lead} ${days} days ago`
}

/** What went, in one line under how long ago: the day, the claim the notice stated, and the months it named. */
export function lienRecordSentWhatWords(n: LienNoticeRecordNotice, mailedYmd: string): string {
  const claim = (n.snapshot?.claimAmount ?? '').trim()
  return [mailedYmd ? demandDate(mailedYmd) : '', claim ? `Notice of claim for ${demandMoney(claim)}` : 'Notice of claim', n.months.length > 0 ? `for ${describeNoticeMonths(n.months)}` : ''].filter(Boolean).join(' · ')
}

/**
 * The delivery record at the top of a copy (the owner, 2026-11-12: at the top, a big check on its left, and the days
 * since it went, so a reader sees at first glance how long ago it was sent and what was sent). The big mark is a check
 * when a copy went on a day the record holds, and an exclamation mark when none did. Each copy has its own line and its
 * own mark, so a copy the record lacks is plain beside the check. The office's line on the saved copy closes the box:
 * it is where a receipt and the day of delivery are written (the owner's own job, 2026-11-12).
 */
function sentBox(n: LienNoticeRecordNotice, todayYmd: string | null | undefined): string {
  const days = [...new Set(n.copies.filter((c) => c.onRecord && c.sentOn).map((c) => c.sentOn))].sort()
  const mailed = days[0] ?? ''
  const lines = n.copies
    .map((c) => {
      const ok = c.onRecord && Boolean(c.sentOn)
      return `<li data-state="${ok ? 'ok' : 'ask'}"><span class="lien-help-mark">${ok ? '✓' : '!'}</span><span>${ok ? esc(lienRecordDeliveryLine(c)) : `<strong>${esc(lienRecordDeliveryLine(c))}</strong>`}</span></li>`
    })
    .join('')
  const note = n.savedNote ? `<li data-state="note" data-lien-record-sent-note><span class="lien-help-mark">•</span><span>${LIEN_RECORD_SAVED_NOTE} — ${esc(n.savedNote)}</span></li>` : ''
  return (
    `<div class="lien-record-sent" data-lien-record-sent="${mailed ? 'sent' : 'none'}">` +
    `<div class="lien-record-sent-mark" aria-hidden="true">${mailed ? '✓' : '!'}</div>` +
    `<div><div class="lien-help-k">Delivery record</div>` +
    `<div class="lien-record-sent-ago" data-lien-record-sent-ago>${esc(lienRecordSentAgoWords(mailed, todayYmd, days.length > 1))}</div>` +
    `<div class="lien-record-sent-what">${esc(lienRecordSentWhatWords(n, mailed))}</div>` +
    `<ul class="lien-record-sent-lines">${lines}${note}</ul></div></div>`
  )
}

/** What a copy needs beyond the record: the job as its head names it, the company's letterhead, and the job's number for the notice's own reference strip. */
export type LienNoticeCopyOptions = {
  jobLabel: string
  /** `Job #4417`, the first item of the strip a notice prints under its letterhead. */
  refJob?: string
  letterhead?: FilingDocExtras['letterhead']
  /** The paper's row on the batch sheet, when the copy prints with a batch. */
  paper?: number
  /** The words on the last copy's foot: what the next page is. */
  after?: string
  /** Today, 'YYYY-MM-DD': the delivery record says how many days ago the notice went. Absent, it says the day. */
  todayYmd?: string | null
}

/** The notices of a record that keep their words: the ones a copy prints for. */
export function lienNoticeCopyNotices(record: LienNoticeRecord | null | undefined): LienNoticeRecordNotice[] {
  return (record?.notices ?? []).filter((n) => n.snapshot !== null)
}

function copyPage(n: LienNoticeRecordNotice, opts: LienNoticeCopyOptions, footRight: string): string {
  if (!n.snapshot) return ''
  const extras: FilingDocExtras = {
    ...(opts.letterhead ? { letterhead: opts.letterhead } : {}),
    refItems: [opts.refJob ?? '', n.months.length > 0 ? `Work months ${describeNoticeMonths(n.months)}` : ''].filter(Boolean),
  }
  // One line for where the mailed paper is: a notice entered after the fact says the saved copy is the paper that went.
  // The office's note on that copy is in the delivery record above, so it is not said twice.
  const where = n.byHand ? (n.savedCopy ? LIEN_RECORD_COPY_BY_HAND : n.savedNote ? LIEN_RECORD_COPY_BY_HAND_NOTE : LIEN_RECORD_COPY_BY_HAND_NO_FILE) : n.savedCopy ? LIEN_RECORD_COPY_SAVED : ''
  const lead = [LIEN_RECORD_COPY_DRAWN, where].filter(Boolean)
  const name = `${opts.paper ? `Paper ${opts.paper} · ` : ''}Copy of notice ${n.n}`
  return (
    `<section class="lien-help" data-lien-help="notice-copy" data-lien-record-copy-of="${n.n}">` +
    STRIPE +
    // What the next page is rides in the band: a foot under the fullest notice ran onto a sheet of its own.
    recordBand(`${name} · do not mail or file this page`, 'The notice as the app recorded it', [opts.jobLabel, footRight]) +
    // The delivery record leads the page: how long ago, what, and each copy's line. The notice is drawn under it.
    sentBox(n, opts.todayYmd) +
    `<p class="lien-help-small" style="margin-bottom:3pt">${lead.map(esc).join(' ')}</p>` +
    `<div class="lien-help-guide-paper lien-record-paper lien-help-watermarked">${filingDocHtml(buildLienNoticeBlocks(n.snapshot, extras))}<div class="lien-help-watermark" data-lien-record-watermark aria-hidden="true">${LIEN_RECORD_COPY_WATERMARK}</div></div>` +
    `</section>`
  )
}

/**
 * A page for each notice of one paper that keeps its words, the first mailed first. '' when none does. Every page
 * ends its own sheet, so the paper behind them starts a fresh one.
 */
export function lienNoticeCopiesHtml(record: LienNoticeRecord | null | undefined, opts: LienNoticeCopyOptions): string {
  const notices = lienNoticeCopyNotices(record)
  return notices.map((n, i) => copyPage(n, opts, i === notices.length - 1 ? (opts.after ?? LIEN_HELP_FOOT_PAPER_NEXT) : `Copy of notice ${notices[i + 1]?.n ?? n.n + 1} is the next page`)).join('')
}
