/**
 * The help sheets that print with a lien affidavit (punch list #314). Pure: the words and the HTML, nothing else.
 *
 * The office signed and notarized its first batch of short-form affidavits on 2026-11-11, and none could be filed as
 * it stood: the county blank at the top held the property's county on every sheet, no notary seal showed, and several
 * papers should have been stopped before they printed. A signed and sealed paper is never corrected by hand, so the
 * sheet has to work before the notary. The owner liked all three shapes, so all three are here:
 *
 * - `lienHelpCoverSheetHtml` — one page in front of one paper, with that job's facts (the Lien window's print);
 * - `lienHelpBatchSheetHtml` — one page in front of a batch, a row for each paper with boxes to tick (the Affidavits
 *   list's **Print N for notarization**);
 * - `lienHelpGuideCopyHtml` — the paper itself with numbered marks beside its blanks and the notes down the side, a
 *   copy to learn from that is never signed or filed;
 * - `lienHelpNoticeSheetHtml` — one page in front of a § 53.056 notice printed from the Lien window: no notary and no
 *   blanks, so it says what the app checked, the two envelopes, and the steps to the mail and back to the app. A notice
 *   sent on the Lien desk's run needs none: the run prints its own first page, *Today's mail* (`lienRunPaper.ts`).
 *
 * A help sheet is never the paper: it carries no sworn word, it is not filed as a sent copy, and every page says so.
 * The words follow `src/lib/plainWords.ts` and name each press as the screen writes it.
 */

import { noticeDeadlineForMonth } from './lienDeadlines'
import { signingCountyWords } from './lienSigningCounty'

export type LienHelpPaper = {
  /** `868 · Service Visit`, as the desk labels the job. */
  jobLabel: string
  propertyAddress: string
  /** The property's county: the clerk the paper is filed with. */
  propertyCounty: string
  /** `$2,650.00`. */
  claim: string
  /** The last day to file, in words (`Mon, Nov 16, 2026`); '' when the caller has none. */
  fileBy: string
  /** Who signs, as the paper names them. */
  signer: string
  ownerName: string
  ownerAddress: string
  /** The original contractor, '' on a job contracted with the owner (the copy goes to the owner alone). */
  contractorName: string
  contractorAddress: string
  /**
   * What the app checked on this paper, with its answers (the best-we-can-do pass). Given, the sheet draws these in
   * place of the list of warnings a reader would check by eye; absent, the list stands.
   */
  checks?: ReadonlyArray<LienHelpCheck>
  /** The county printed on the paper's two county lines (`Travis County`); '' when the notary writes them by hand. */
  signingCounty?: string
  /** Where the property's county clerk takes a filing, as the office typed it in Settings; absent when nobody has. */
  clerk?: LienHelpClerk
  /** Who to ask, in words (`lienHelpAskWords`): the lien leader and the dev. '' when the app has neither. */
  ask?: string
}

/** A county clerk's facts as the office typed them in Settings. The app never guesses one. */
export type LienHelpClerk = { where: string; fee: string; hours: string }

/** The clerk's facts on one line, the typed ones only; '' when none is typed. */
export function lienHelpClerkLine(clerk: LienHelpClerk | null | undefined): string {
  if (!clerk) return ''
  const hours = clerk.hours.trim()
  return [clerk.where.trim(), clerk.fee.trim(), hours ? `open ${hours}` : ''].filter(Boolean).join(' · ')
}

/** One person to ask: a name, and a phone when the app holds one. */
export type LienHelpAskPerson = { name: string; phone?: string | null }

/**
 * Who a reader asks when unsure: the lien leader on the job, or the dev (the owner, 2026-11-11: *they should call the
 * leader or the dev*). One of them alone when the other is unknown or is the same person; '' when the app has neither.
 */
export function lienHelpAskWords(leader: LienHelpAskPerson | null | undefined, dev: LienHelpAskPerson | null | undefined): string {
  const say = (who: LienHelpAskPerson | null | undefined): string => {
    const name = (who?.name ?? '').trim()
    const phone = (who?.phone ?? '').trim()
    return name ? (phone ? `${name}, ${phone}` : name) : ''
  }
  const same = (leader?.name ?? '').trim().toLowerCase() === (dev?.name ?? '').trim().toLowerCase()
  const people = [say(leader), same ? '' : say(dev)].filter(Boolean)
  return people.length > 0 ? `Not sure? Ask ${people.join(', or ')}.` : ''
}

/** One thing the app checked on a paper: `ok` it stands, `ask` it wants a person's answer before the paper is signed. */
export type LienHelpCheck = { state: 'ok' | 'ask'; lead: string; words: string }

/**
 * What the app checked on one paper. A warning printed on every paper is one people stop reading, and the app already
 * holds most of the answers: who the owner is, what the record says of a homestead, and whether each sworn month has a
 * notice behind it. The reader is left the one check the app cannot make, the paper's own words.
 */
export function lienHelpChecks(f: {
  ownerName: string
  /** '' | residential | non_residential */
  propertyKind: string | null | undefined
  homestead: boolean
  isSub: boolean
  /** The months the paper swears, in words. */
  monthsWords: string
  /** The notice check's lines (`lienNoticeCheckLines`); none when every month has a timely notice to both. */
  noticeLines: ReadonlyArray<string>
  contractorName: string
}): LienHelpCheck[] {
  const checks: LienHelpCheck[] = []
  const owner = f.ownerName.trim()
  checks.push({ state: 'ok', lead: 'Owner.', words: `${owner ? `${owner}. ` : ''}A private owner, not a city, a county, a school or the State.` })
  if ((f.propertyKind ?? '').trim() !== 'non_residential') {
    // What the record says, never more: the app cannot know a house is not a homestead, only that nobody marked it one.
    if (f.homestead) checks.push({ state: 'ask', lead: 'Homestead.', words: 'The property record says this is a homestead. That goes to the attorney.' })
    else checks.push({ state: 'ok', lead: 'Homestead.', words: 'The property record is not marked a homestead.' })
  }
  if (f.isSub) {
    const contractor = f.contractorName.trim() || 'the original contractor'
    if (f.noticeLines.length > 0) checks.push({ state: 'ask', lead: 'Notices.', words: f.noticeLines.join(' ') })
    else if (f.monthsWords.trim()) checks.push({ state: 'ok', lead: 'Notices.', words: `A notice went on time for every month sworn: ${f.monthsWords.trim()}. It went to the owner and to ${contractor}.` })
    else checks.push({ state: 'ask', lead: 'Notices.', words: 'The paper names no month of work with a notice behind it.' })
  }
  return checks
}

/** What is left to the reader once the app has answered its own checks. */
export const LIEN_HELP_YOUR_CHECK = 'Read every name, address and amount on the paper. If one is wrong, stop. Fix it in the app and print again. A signed paper is never fixed by hand.'

/** Above the reader's check when the app has a question about this paper. */
export const LIEN_HELP_ASK_FIRST = 'Do not sign this one yet. Ask the attorney about the line marked with an exclamation mark.'

/** The four things written on a paper whose counties are printed. */
export const LIEN_HELP_BLANKS_PRINTED_COUNTY: ReadonlyArray<readonly [string, string]> = [
  ['The signature line.', 'The signer signs in front of the notary, and not before.'],
  ['The day, the month and the year.', 'The day it is signed.'],
  ['The notary’s signature and printed name.', 'Both lines.'],
  ['The notary’s seal.', 'In ink, dark enough to show on a copy. A paper with no seal goes back.'],
]

/**
 * The batch sheet's list on a paper whose counties are printed: three things to write. The notary's signature, printed
 * name and seal are one line, the notarial certificate (the owner, 2026-11-13, working from a printed batch).
 */
export const LIEN_HELP_BLANKS_PRINTED_COUNTY_SHORT: ReadonlyArray<readonly [string, string]> = [
  ['Signature:', 'in front of the notary.'],
  ['Day, month, year:', 'the day it is signed.'],
  ['Notarial certificate:', 'notary signs and stamps.'],
]

/** Under the blanks when the counties are printed: where the paper says it was signed, and what to do if that is wrong. */
export function lienHelpPrintedCountyLine(signingCounty: string): string {
  return `The counties are printed: signed in ${signingCounty}. Signing somewhere else? Change the county beside the print press and print again.`
}

/** A paper the batch left out, with the reason in the desk's words. */
export type LienHelpLeftOut = { jobLabel: string; reason: string }

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The six blanks on a short-form affidavit, in the order the pen meets them. `[bold lead, the rest]`. */
export const LIEN_HELP_BLANKS: ReadonlyArray<readonly [string, string]> = [
  ['COUNTY OF, at the top.', 'The notary writes the county you are standing in when you sign. It is not the property’s county.'],
  ['The signature line.', 'The signer signs in front of the notary, and not before.'],
  ['COUNTY OF, in the notary’s block.', 'The same county as the first blank.'],
  ['The day, the month and the year.', 'The day it is signed.'],
  ['The notary’s signature and printed name.', 'Both lines.'],
  ['The notary’s seal.', 'In ink, dark enough to show on a copy. A paper with no seal goes back.'],
]

/**
 * The batch sheet's list, where the room goes to the rows: five blanks in a few words each. The cover sheet's six count
 * the notary's signature and the seal apart; here they are one line, the notarial certificate, and the picture beside
 * the list carries one number for both (the owner, 2026-11-13). Each name is on its own line, its words under it.
 */
export const LIEN_HELP_BLANKS_SHORT: ReadonlyArray<readonly [string, string]> = [
  ['COUNTY OF, at the top:', 'where you sign. Not the property’s county.'],
  ['Signature:', 'in front of the notary.'],
  ['COUNTY OF, notary’s block:', 'the same county.'],
  ['Day, month, year:', 'the day it is signed.'],
  ['Notarial certificate:', 'notary signs and stamps.'],
]

/** The batch sheet's heading over its list, from the count of the list itself, so the two cannot part. */
export function lienHelpBatchBlanksTitle(printedCounty: boolean): string {
  return printedCounty ? `Each paper has ${COUNT_WORDS[LIEN_HELP_BLANKS_PRINTED_COUNTY_SHORT.length]} things to write` : `Each paper has ${COUNT_WORDS[LIEN_HELP_BLANKS_SHORT.length]} blanks`
}

const COUNT_WORDS: Readonly<Record<number, string>> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six' }

/** When to stop before signing. Each is one thing the office does not decide alone. */
export const LIEN_HELP_STOPS: ReadonlyArray<string> = [
  'The owner lives in this house. That is a homestead, and it goes to the attorney.',
  'The owner is a city, a county, a school or the State. A lien does not attach there.',
  'The owner line names an office or a job title, such as ATTN, where an owner’s name should be.',
  'A month the paper names has no notice mailed on time, or the contractor got no copy.',
  'Your stack holds more than one affidavit for the same property.',
  'Any word, name, address or amount on the paper is wrong.',
]

/** The stop list in a few words each, for the batch sheet. */
export const LIEN_HELP_STOPS_SHORT: ReadonlyArray<string> = [
  'The owner lives in the house.',
  'The owner is a city, county, school or the State.',
  'The owner line is an office or a title, such as ATTN.',
  'A month has no notice mailed on time.',
  'Anything printed on a paper is wrong.',
]

/** The rule under the stop list. */
export const LIEN_HELP_NEVER_FIX = 'A signed and sealed paper is never fixed by hand. Fix it in the app, print it again, and sign the new one.'

/** What happens after the notary. `{clerk}` is the property's county. The presses are the Lien window's own. */
const WRITE = '<span class="lien-help-write"></span>'

/**
 * The steps after the notary. The sheet carries the facts back to the desk, so the recording number, the day filed and
 * the mail-by day each have a line to write on. `clerkLine` is the clerk's address, fee and hours as the office typed
 * them in Settings (`lienHelpClerkLine`); without one the step says only that the clerk charges a fee.
 */
export function lienHelpAfterSteps(clerkCounty: string, hasContractor: boolean, clerkLine = '', hasCode = false): string[] {
  const clerk = clerkCounty.trim() ? `${clerkCounty.trim()} County Clerk` : 'County Clerk of the property’s county'
  return [
    `File the original with the <strong>${esc(clerk)}</strong>. That is the property’s county. ${clerkLine.trim() ? `<br/><span class="lien-help-small">${esc(clerkLine.trim())}</span>` : 'The clerk charges a fee for each paper.'}`,
    `Write on the stamped copy, and here. Recording number ${WRITE} Filed on ${WRITE}`,
    // With a code on the sheet (change 5, the code half) the phone lands on the job's affidavit tab; the desk's own door stays named for a computer.
    hasCode
      ? 'The same day, scan the code with a phone. On a computer, open the job on the Lien desk and press <strong>Open the affidavit tab ›</strong>. Press <strong>Record filing…</strong> and type both.'
      : 'The same day, open the job on the Lien desk. Press <strong>Open the affidavit tab ›</strong>, then <strong>Record filing…</strong>, and type both.',
    `${hasContractor ? 'Mail a copy by certified mail to the owner and to the original contractor.' : 'Mail a copy by certified mail to the owner.'} The app shows the last day to mail. Mail by ${WRITE}`,
    // The form takes the day the copies went out, and since punch list #314's change 5 each copy's certified mail number and a photo of its receipt.
    `${hasCode ? 'Scan the code again. ' : ''}Press <strong>Record service…</strong> and set the day the copies were mailed. Type each certified mail number and take a photo of each receipt.`,
    'Keep the clerk’s stamped copy and the certified mail receipts with the job.',
  ]
}

/** The same steps in a few words each, for the guide copy's side column. */
export function lienHelpAfterStepsShort(clerkCounty: string, hasContractor: boolean): string[] {
  const clerk = clerkCounty.trim() ? `${clerkCounty.trim()} County Clerk` : 'County Clerk of the property’s county'
  return [`File with the <strong>${esc(clerk)}</strong>.`, 'In the app: <strong>Record filing…</strong>', hasContractor ? 'Mail copies to the owner and the contractor.' : 'Mail a copy to the owner.', 'In the app: <strong>Record service…</strong>']
}

/**
 * The batch sheet's steps after the notary. With a code on the sheet the phone lands on the Affidavits list, each job a
 * press from its own affidavit tab. Record service… asks for each copy's mail number and receipt photo, so the step does.
 */
export function lienHelpBatchAfterSteps(hasCode = false): string[] {
  return [
    'File each clerk’s papers together. Write the recording number and the day filed on the stamped copy, and on the row.',
    hasCode
      ? 'The same day, scan the code with a phone. It opens the Affidavits list. On each job press <strong>Open the affidavit tab ›</strong>, then <strong>Record filing…</strong>, and type both.'
      : 'The same day, open the job on the Lien desk. Press <strong>Open the affidavit tab ›</strong>, then <strong>Record filing…</strong>.',
    'Mail a copy by certified mail to each name on the row. The app shows the last day to mail.',
    `${hasCode ? 'Scan the code again. On each job press' : 'Press'} <strong>Record service…</strong> and set the day the copies were mailed. Type each mail number and take a photo of each receipt. Tick the row. Keep the receipts with the job.`,
  ]
}

/** The words under the code that opens the place to record. A cover sheet's corner holds the lead alone; its steps say what the code opens. */
export const LIEN_HELP_RECORD_CODE_WORDS = {
  lead: 'Scan to record',
  batch: 'Opens the Affidavits list',
  notice: 'Opens the notice tab',
} as const

/**
 * The page's own styles. Every rule sits under `.lien-help`, so the paper beside it keeps its look.
 *
 * The leading and the gaps between the boxes are a point tighter than they first were (punch list #322). Printed for
 * real jobs with the county left blank, a cover sheet ran onto a second sheet: its box *After it is signed* moved
 * whole to page 2, with or without an **Ask first** band. Measured on those prints, this spacing puts the sheet back
 * on one page with the type size as it was.
 */
export const LIEN_HELP_STYLES = `
  .lien-help { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; line-height: 1.26; color: #111418; break-after: page; page-break-after: always; margin-bottom: 4rem; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .lien-help-stripe { height: 6pt; margin-bottom: 5pt; border: 1pt solid #111418; background: repeating-linear-gradient(135deg, #111418 0 6pt, #fff 6pt 12pt); }
  .lien-help-picture { border: 1pt solid #111418; padding: 4pt 6pt; font-family: Georgia, 'Times New Roman', serif; font-size: 6.5pt; line-height: 1.3; background: #fff; }
  .lien-help-picture .lien-help-num { width: 10pt; height: 10pt; font-size: 6.5pt; margin: 0 1pt; }
  .lien-help-picture-line { height: 3pt; background: #cfcfcf; margin: 2.4pt 0; }
  .lien-help-pictured { display: grid; grid-template-columns: 34% 1fr; gap: 8pt; align-items: start; }
  .lien-help-write { display: inline-block; min-width: 80pt; border-bottom: 1pt solid #111418; }
  .lien-help-watermarked { position: relative; }
  .lien-help-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 800 44pt system-ui, Arial, sans-serif; color: rgba(0, 0, 0, 0.1); transform: rotate(-28deg); pointer-events: none; letter-spacing: 0.08em; white-space: nowrap; }
  .lien-help-code { display: flex; gap: 6pt; align-items: center; }
  .lien-help-code img { width: 38pt; height: 38pt; display: block; }
  .lien-help-record { float: right; width: 78pt; margin: 0 0 2pt 10pt; text-align: center; font-size: 7.5pt; line-height: 1.2; }
  .lien-help-record img { width: 54pt; height: 54pt; display: block; margin: 0 auto 1pt; image-rendering: pixelated; }
  .lien-help-record-corner { width: 62pt; margin: -3pt 0 0 10pt; white-space: nowrap; }
  .lien-help-record-corner img { width: 44pt; height: 44pt; }
  .lien-help-rows tr.lien-help-group td { background: #ececec; font-weight: 800; }
  .lien-help h2 { font-size: 15pt; margin: 0; line-height: 1.15; }
  .lien-help h3 { font-size: 10.5pt; margin: 0 0 3pt; text-transform: uppercase; letter-spacing: 0.05em; }
  .lien-help p { margin: 0 0 4pt; }
  .lien-help ol, .lien-help ul { margin: 0; padding-left: 15pt; }
  .lien-help li { margin: 0 0 1.5pt; }
  .lien-help-band { display: flex; justify-content: space-between; gap: 10pt; align-items: flex-start; border: 2pt solid #111418; padding: 4pt 8pt; margin-bottom: 4pt; }
  .lien-help-tag { font-weight: 800; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; }
  .lien-help-facts { display: grid; grid-template-columns: repeat(4, 1fr); border: 1pt solid #111418; margin-bottom: 4pt; }
  .lien-help-facts > div { padding: 4pt 6pt; border-right: 1pt solid #111418; }
  .lien-help-facts > div:last-child { border-right: none; }
  .lien-help-k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
  .lien-help-v { font-weight: 700; }
  .lien-help-box { border: 1pt solid #111418; padding: 4pt 8pt; margin-bottom: 4pt; break-inside: avoid; page-break-inside: avoid; }
  .lien-help-stop { border: 2.5pt solid #111418; background: #f1f1f1; }
  .lien-help-stop h3::before { content: 'STOP'; background: #111418; color: #fff; padding: 0 4pt; margin-right: 6pt; }
  .lien-help-two { display: grid; grid-template-columns: 1fr 1fr; gap: 5pt; }
  .lien-help-checks { border: 1pt solid #111418; margin-bottom: 4pt; break-inside: avoid; page-break-inside: avoid; }
  .lien-help-checks h3 { padding: 3pt 8pt; margin: 0; border-bottom: 1pt solid #111418; background: #ececec; }
  .lien-help-checks ul { list-style: none; padding: 3pt 8pt; margin: 0; }
  .lien-help-checks li { display: grid; grid-template-columns: 13pt 1fr; gap: 3pt; margin: 0 0 2pt; }
  .lien-help-mark { font-weight: 800; }
  .lien-help-ask { border: 2.5pt solid #111418; background: #f1f1f1; padding: 3pt 8pt; margin-bottom: 4pt; break-inside: avoid; page-break-inside: avoid; }
  .lien-help-yours { border-width: 1pt; background: #fff; }
  .lien-help-ask-tag { background: #111418; color: #fff; padding: 0 4pt; margin-right: 5pt; letter-spacing: 0.05em; }
  .lien-help-tick { display: inline-block; width: 9pt; height: 9pt; border: 1pt solid #111418; vertical-align: -1pt; }
  .lien-help-num { display: inline-flex; align-items: center; justify-content: center; width: 13pt; height: 13pt; border-radius: 50%; background: #111418; color: #fff; font: 700 8pt system-ui, Arial, sans-serif; vertical-align: 1pt; margin: 0 3pt; }
  .lien-help-small { font-size: 8.5pt; color: #333; }
  .lien-help-foot { border-top: 1pt solid #111418; margin-top: 6pt; padding-top: 3pt; font-size: 8pt; display: flex; justify-content: space-between; gap: 10pt; }
  .lien-help-rows { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; line-height: 1.25; margin-bottom: 7pt; }
  .lien-help-rows th, .lien-help-rows td { border: 1pt solid #111418; padding: 3pt 4pt; text-align: left; vertical-align: top; }
  .lien-help-rows th { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.03em; background: #ececec; }
  .lien-help-rows tr { break-inside: avoid; page-break-inside: avoid; }
  .lien-help-flag { font-weight: 800; }
  .lien-help-guide { display: grid; grid-template-columns: 62% 1fr; gap: 10pt; align-items: start; }
  .lien-help-guide-paper { border: 1pt solid #111418; padding: 10pt; font-family: Georgia, 'Times New Roman', serif; font-size: 9pt; line-height: 1.4; }
  @media print { .lien-help { margin: 0 -0.35in; } }
`

/**
 * What the caller draws for a sheet, each a QR code's own markup (an image). `guideCode` opens the full guide and sits in
 * the band's corner. `recordCode` opens the place in the app where the filing and the mail receipts are recorded, and
 * sits beside the steps after the notary, where the reader is when it is wanted (change 5, the code half). The guide
 * copy takes none: it is a page to learn from, and nothing is recorded off it.
 */
export type LienHelpExtras = { guideCode?: string; recordCode?: string; /** The notice record prints behind this sheet (punch list #322): the sheet points at it and leaves it the detail. */ recordFollows?: boolean }

/** The cover sheet's notices line when the notice record is the next page: the record lays out each notice and each month, so the sheet only points. */
export const LIEN_HELP_NOTICES_SEE_RECORD = 'A month has a late or missing notice. The notice record on the next page shows each one.'

/** The foot's right side when a notice record sits between a help sheet and the paper. */
export const LIEN_HELP_FOOT_RECORD_NEXT = 'The notice record is next, then the paper to sign'
export const LIEN_HELP_FOOT_PAPER_NEXT = 'The paper to sign is the next page'

/**
 * The code to record, floated in a box of steps, so only the lines beside it run short. The batch sheet has room, and
 * its code sits in the box's top corner with what it opens under it. The cover sheet has none: its fullest print fills
 * the page to the point, and a column for the code, or the top corner, put the foot on a second page. There the code
 * is smaller and hangs from the last step, beside that one short line and the names the copies go to, where the box
 * was empty.
 */
const recordCodeBlock = (code: string | undefined, under: string): string =>
  code ? `<div class="lien-help-record${under ? '' : ' lien-help-record-corner'}" data-lien-help-record-code>${code}<strong>${esc(LIEN_HELP_RECORD_CODE_WORDS.lead)}</strong>${under ? `<br/>${esc(under)}` : ''}</div>` : ''

/** The band at the top of every sheet. The code to scan sits in its right corner, where the band has room to spare, so it adds no height to the page. */
const band = (tag: string, title: string, right: string[], extras?: LienHelpExtras): string =>
  `<div class="lien-help-band"><div><div class="lien-help-tag">${esc(tag)}</div><h2>${esc(title)}</h2></div>` +
  `<div class="lien-help-code"><div class="lien-help-small" style="text-align:right">${[...right.filter(Boolean), extras?.guideCode ? 'Scan for the full guide' : ''].filter(Boolean).map(esc).join('<br/>')}</div>${extras?.guideCode ? `<span data-lien-help-code>${extras.guideCode}</span>` : ''}</div></div>`

/** A striped top edge (change 11): a help sheet is easy to pull from a stack before the stack goes to the clerk. */
export const STRIPE = '<div class="lien-help-stripe"></div>'

export const foot = (left: string, right: string): string => `<div class="lien-help-foot"><span>${esc(left)}</span><span>${esc(right)}</span></div>`

const stopBox = (title: string, items: ReadonlyArray<string>): string =>
  `<div class="lien-help-box lien-help-stop"><h3>${esc(title)}</h3><ul>${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="lien-help-small" style="margin-top:3pt">${esc(LIEN_HELP_NEVER_FIX)}</p></div>`

/** `stacked` puts each blank's name on a line of its own with its words under it, the batch sheet's list. */
const blanksBox = (title: string, signer: string, blanks: ReadonlyArray<readonly [string, string]> = LIEN_HELP_BLANKS, under = '', picture = '', stacked = false): string =>
  `<div class="lien-help-box"><h3>${esc(title)}</h3>${picture ? `<div class="lien-help-pictured">${picture}<div>` : ''}<ol>${blanks.map(([lead, rest]) => `<li><strong${stacked ? ' style="display:block"' : ''}>${esc(lead)}</strong> ${esc(lead === 'The signature line.' && signer.trim() ? `${signer.trim()} signs in front of the notary, and not before.` : rest)}</li>`).join('')}</ol>${under ? `<p class="lien-help-small" style="margin-top:3pt">${esc(under)}</p>` : ''}${picture ? '</div></div>' : ''}</div>`

const pictureNum = (n: number): string => `<span class="lien-help-num">${n}</span>`

/**
 * A small picture of the paper with a numbered spot where each thing is written (the best-we-can-do pass, change 6):
 * words like *the signature line* make a first-timer hunt for the place. The numbers are the list's own, in the order
 * the pen meets them: six on a paper whose counties are blank, four when they are printed. With `certificateAsOne`, the
 * batch sheet's picture, the notary's signature and seal share one number: five, or three.
 */
export function lienHelpPictureHtml(printedCounty: string, certificateAsOne = false): string {
  const printed = printedCounty.trim().replace(/\s+county$/i, '').toUpperCase()
  let n = 0
  const next = () => pictureNum(++n)
  const line = '<div class="lien-help-picture-line"></div>'
  const short = '<div class="lien-help-picture-line" style="width:55%"></div>'
  return (
    `<div class="lien-help-picture" data-lien-help-picture aria-hidden="true">` +
    `<div style="text-align:center;font-weight:700">LIEN AFFIDAVIT</div>` +
    `<div>STATE OF TEXAS<br/>COUNTY OF ${printed ? esc(printed) : `______ ${next()}`}</div>` +
    line + line + short + line + line + short + line +
    `<div style="text-align:right;margin-top:4pt">______________ ${next()}</div>` +
    `<div style="margin-top:4pt">COUNTY OF ${printed ? esc(printed) : `______ ${next()}`}</div>` +
    `<div>on this ____ day of ________ ${next()}</div>` +
    `<div style="margin-top:4pt">______________ ${certificateAsOne ? next() : `${next()} ${next()}`}</div>` +
    `<div>Notary Public · Printed name: ________</div>` +
    `</div>`
  )
}

const MARK: Record<LienHelpCheck['state'], string> = { ok: '✓', ask: '!' }

/** The block of checks the app answered, then what is left to the reader; an *ask first* band between them when any check wants an answer. */
const checksBlock = (title: string, checks: ReadonlyArray<LienHelpCheck>, ask = '', askFirst: string = LIEN_HELP_ASK_FIRST): string =>
  `<div class="lien-help-checks" data-lien-help-checks><h3>${esc(title)}</h3><ul>${checks.map((c) => `<li data-state="${c.state}"><span class="lien-help-mark">${MARK[c.state]}</span><span><strong>${esc(c.lead)}</strong> ${esc(c.words)}</span></li>`).join('')}</ul></div>` +
  (checks.some((c) => c.state === 'ask') ? `<div class="lien-help-ask" data-lien-help-ask><strong class="lien-help-ask-tag">ASK FIRST</strong> ${esc(askFirst)}</div>` : '') +
  `<div class="lien-help-ask lien-help-yours"><strong class="lien-help-ask-tag">YOUR CHECK</strong> ${esc(LIEN_HELP_YOUR_CHECK)}${ask ? ` <strong data-lien-help-ask-who>${esc(ask)}</strong>` : ''}</div>`

const party = (name: string, address: string): string => [name.trim(), address.trim()].filter(Boolean).map(esc).join('<br/>')

/** A, one page in front of one paper: the job's facts, when to stop, the blanks, and what happens after the notary. */
export function lienHelpCoverSheetHtml(p: LienHelpPaper, printedOn: string, extras?: LienHelpExtras): string {
  const recordCode = extras?.recordCode
  const after = lienHelpAfterSteps(p.propertyCounty, Boolean(p.contractorName.trim()), lienHelpClerkLine(p.clerk), Boolean(recordCode))
  const ask = (p.ask ?? '').trim()
  const printedCounty = p.signingCounty?.trim() ?? ''
  // With the notice record behind it, the sheet keeps the mark and points at the record, which says each month in full.
  const checks = extras?.recordFollows ? (p.checks ?? []).map((c) => (c.lead === 'Notices.' && c.state === 'ask' ? { ...c, words: LIEN_HELP_NOTICES_SEE_RECORD } : c)) : p.checks
  const copies = [
    `<div class="lien-help-small"><strong>Owner</strong><br/>${party(p.ownerName, p.ownerAddress) || 'not on the paper'}</div>`,
    p.contractorName.trim() ? `<div class="lien-help-small"><strong>Original contractor</strong><br/>${party(p.contractorName, p.contractorAddress)}</div>` : '<div></div>',
  ].join('')
  return (
    `<section class="lien-help" data-lien-help="cover">` +
    STRIPE +
    band('Help sheet · do not file this page', 'Lien affidavit: before you sign', [printedOn ? `Printed ${printedOn}` : '', 'Stays with the job'], extras) +
    `<div class="lien-help-facts">` +
    `<div><div class="lien-help-k">Job</div><div class="lien-help-v">${esc(p.jobLabel)}</div></div>` +
    `<div><div class="lien-help-k">Property</div><div class="lien-help-v">${esc(p.propertyAddress)}</div></div>` +
    `<div><div class="lien-help-k">Claim</div><div class="lien-help-v">${esc(p.claim)}</div></div>` +
    `<div><div class="lien-help-k">File by</div><div class="lien-help-v">${esc(p.fileBy || 'see the Lien desk')}</div></div>` +
    `</div>` +
    (checks && checks.length > 0 ? checksBlock('What the app checked on this paper', checks, ask) : stopBox('Do not sign. Call the office first if any of these is true.', LIEN_HELP_STOPS)) +
    (printedCounty
      ? blanksBox('Four things to write. Nothing else is written on the paper.', p.signer, LIEN_HELP_BLANKS_PRINTED_COUNTY, lienHelpPrintedCountyLine(printedCounty), lienHelpPictureHtml(printedCounty))
      : blanksBox('The blanks. Nothing else is written on the paper.', p.signer, LIEN_HELP_BLANKS, '', lienHelpPictureHtml(''))) +
    `<div class="lien-help-box" style="overflow:hidden"><h3>After it is signed</h3><ol>${after.map((s, i) => `<li>${i === after.length - 1 ? recordCodeBlock(recordCode, '') : ''}<span class="lien-help-tick"></span> ${s}</li>`).join('')}</ol><div class="lien-help-two" style="margin-top:5pt">${copies}</div></div>` +
    foot(`Help sheet for ${p.jobLabel}${ask && !(p.checks && p.checks.length > 0) ? ` · ${ask}` : ''}`, extras?.recordFollows ? LIEN_HELP_FOOT_RECORD_NEXT : LIEN_HELP_FOOT_PAPER_NEXT) +
    `</section>`
  )
}

/** The facts a notice's help sheet reads off the notice's own fields, so the sheet and the notice cannot disagree. */
export type LienHelpNotice = {
  jobLabel: string
  propertyAddress: string
  /** `$2,650.00`. */
  claim: string
  /** The last day to mail, in words; '' when the app has none for this job. */
  mailBy: string
  /** The mail-by day has gone by. */
  mailByPassed: boolean
  /** Who signs, as the notice names them. */
  signer: string
  ownerName: string
  ownerAddress: string
  contractorName: string
  contractorAddress: string
  /** How many invoices print behind the notice. */
  invoices: number
  /** Who to ask (`lienHelpAskWords`); '' when the app has neither. */
  ask?: string
}

/**
 * What the app checked on one notice. A notice has no notary and no blank, so the things that go wrong are the ones the
 * app can see: an owner with no mailing address, a day to mail that has gone by, and whether an invoice rides behind it.
 */
export function lienHelpNoticeChecks(n: Pick<LienHelpNotice, 'ownerName' | 'ownerAddress' | 'contractorName' | 'contractorAddress' | 'mailBy' | 'mailByPassed' | 'invoices'>): LienHelpCheck[] {
  const checks: LienHelpCheck[] = []
  const owner = n.ownerName.trim()
  if (owner && n.ownerAddress.trim()) checks.push({ state: 'ok', lead: 'Owner.', words: `${owner}, with a mailing address.` })
  else checks.push({ state: 'ask', lead: 'Owner.', words: owner ? `${owner} has no mailing address in the app.` : 'The app has no owner for this property.' })
  const contractor = n.contractorName.trim()
  if (contractor && n.contractorAddress.trim()) checks.push({ state: 'ok', lead: 'Original contractor.', words: `${contractor}, with a mailing address.` })
  else checks.push({ state: 'ask', lead: 'Original contractor.', words: contractor ? `${contractor} has no mailing address in the app.` : 'The notice names no original contractor.' })
  const day = n.mailBy.trim()
  if (!day) checks.push({ state: 'ask', lead: 'Mail by.', words: 'The app has no last day to mail for this job.' })
  else if (n.mailByPassed) checks.push({ state: 'ask', lead: 'Mail by.', words: `The last day to mail was ${day}. It has passed.` })
  else checks.push({ state: 'ok', lead: 'Mail by.', words: `The last day to mail is ${day}.` })
  checks.push({ state: 'ok', lead: 'Invoices.', words: n.invoices === 0 ? 'No invoice prints behind this notice.' : n.invoices === 1 ? '1 invoice prints behind this notice.' : `${n.invoices} invoices print behind this notice.` })
  return checks
}

/**
 * The last day to mail a notice that names these months (`2026-09`): the earliest of their days, since a notice mailed
 * after it is late for that month. `passed` once today is past it. '' with no month the clock can read.
 */
export function lienHelpNoticeMailBy(months: ReadonlyArray<string>, propertyKind: string | null | undefined, todayYmd: string): { ymd: string; passed: boolean } {
  const days = months
    .map((m) => noticeDeadlineForMonth(`${m.trim()}-01`, propertyKind ?? ''))
    .filter(Boolean)
    .sort()
  const ymd = days[0] ?? ''
  return { ymd, passed: Boolean(ymd) && todayYmd > ymd }
}

/** Above the reader's check when the app has a question about this notice. */
export const LIEN_HELP_NOTICE_ASK_FIRST = 'Do not mail this one yet. Ask about the line marked with an exclamation mark.'

/**
 * The steps from the printer to the mail and back to the app. The Lien window prints one notice, so the sheet says to
 * make the second set. The numbers from the two green slips have a line each, since the app asks for both.
 */
export function lienHelpNoticeSteps(n: Pick<LienHelpNotice, 'signer' | 'mailBy' | 'mailByPassed'>, hasCode = false): string[] {
  const signer = n.signer.trim()
  const day = n.mailBy.trim()
  return [
    'Copy every page behind this sheet. One set is for the owner. One set is for the original contractor.',
    `${signer ? esc(signer) : 'The signer'} signs the notice in each set, in ink.`,
    'Put each set in its own envelope. The two addresses are on this sheet.',
    `Send both by certified mail with a return receipt. ${day && !n.mailByPassed ? `Mail by <strong>${esc(day)}</strong>.` : 'The app shows the last day to mail.'}`,
    `Write the number from each green slip. Owner ${WRITE} Contractor ${WRITE}`,
    hasCode
      ? 'The same day, scan the code with a phone. On a computer, open the job’s Lien window on the <strong style="white-space:nowrap">§ 53.056 notice</strong> tab.'
      : 'The same day, open the job’s Lien window on the <strong style="white-space:nowrap">§ 53.056 notice</strong> tab.',
    'Press <strong>Save &amp; record sends…</strong> and type both numbers. Then press <strong>Record both sends</strong>.',
    'Keep the green slips and the return receipts with the job.',
  ]
}

/**
 * One page in front of a § 53.056 notice printed from the Lien window: the job's facts, what the app checked, the two
 * envelopes, and the steps. The record code hangs in the steps box's corner, where the batch sheet's does.
 */
export function lienHelpNoticeSheetHtml(n: LienHelpNotice, printedOn: string, extras?: LienHelpExtras): string {
  const recordCode = extras?.recordCode
  const ask = (n.ask ?? '').trim()
  const steps = lienHelpNoticeSteps(n, Boolean(recordCode))
  const envelope = (who: string, name: string, address: string): string => `<div class="lien-help-box" style="margin-bottom:0"><h3>${esc(who)}</h3><p>${party(name, address) || 'not in the app'}</p></div>`
  return (
    `<section class="lien-help" data-lien-help="notice">` +
    STRIPE +
    band('Help sheet · do not mail this page', '§ 53.056 notice: before you mail', [printedOn ? `Printed ${printedOn}` : '', 'Stays with the job'], extras) +
    `<div class="lien-help-facts">` +
    `<div><div class="lien-help-k">Job</div><div class="lien-help-v">${esc(n.jobLabel)}</div></div>` +
    `<div><div class="lien-help-k">Property</div><div class="lien-help-v">${esc(n.propertyAddress)}</div></div>` +
    `<div><div class="lien-help-k">Claim</div><div class="lien-help-v">${esc(n.claim)}</div></div>` +
    `<div><div class="lien-help-k">Mail by</div><div class="lien-help-v">${esc(n.mailBy.trim() || 'see the Lien desk')}</div></div>` +
    `</div>` +
    checksBlock('What the app checked on this notice', lienHelpNoticeChecks(n), ask, LIEN_HELP_NOTICE_ASK_FIRST) +
    `<div class="lien-help-two" style="margin-bottom:5pt" data-lien-help-envelopes>${envelope('Envelope 1 · the owner', n.ownerName, n.ownerAddress)}${envelope('Envelope 2 · the original contractor', n.contractorName, n.contractorAddress)}</div>` +
    `<div class="lien-help-box" style="overflow:hidden">${recordCodeBlock(recordCode, LIEN_HELP_RECORD_CODE_WORDS.notice)}<h3>From the printer to the mail</h3><ol>${steps.map((s) => `<li><span class="lien-help-tick"></span> ${s}</li>`).join('')}</ol></div>` +
    foot(`Help sheet for ${n.jobLabel}`, 'The notice is the next page') +
    `</section>`
  )
}

const streetKey = (address: string): string => address.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Which papers of a batch sit on a property an earlier paper of the batch is on: the row number each repeats, by its
 * own index. One affidavit for several jobs at a property is counsel's question, so the sheet says *ask first*.
 */
export function lienHelpSameProperty(papers: ReadonlyArray<Pick<LienHelpPaper, 'propertyAddress'>>): Map<number, number> {
  const first = new Map<string, number>()
  const repeats = new Map<number, number>()
  papers.forEach((p, i) => {
    const key = streetKey(p.propertyAddress)
    if (!key) return
    const seen = first.get(key)
    if (seen === undefined) first.set(key, i)
    else repeats.set(i, seen)
  })
  return repeats
}

/**
 * What each paper of a batch wants asked before it is signed, by its index: a check the app could not clear, and a
 * property an earlier paper of the batch is on. A paper with nothing to ask is absent.
 */
export function lienHelpBatchAsks(papers: ReadonlyArray<Pick<LienHelpPaper, 'propertyAddress' | 'checks'>>): Map<number, string[]> {
  const repeats = lienHelpSameProperty(papers)
  const asks = new Map<number, string[]>()
  papers.forEach((p, i) => {
    const lines = (p.checks ?? []).filter((c) => c.state === 'ask').map((c) => `${c.lead} ${c.words}`)
    const repeat = repeats.get(i)
    if (repeat !== undefined) lines.push(`Same property as paper ${repeat + 1}.`)
    if (lines.length > 0) asks.set(i, lines)
  })
  return asks
}

/** The batch in one line: how many are clear, how many want a question answered, how many were not printed. */
export function lienHelpBatchSummary(n: { papers: number; asks: number; leftOut: number }): string {
  const clear = n.papers - n.asks
  const parts = [`${clear} clear to sign.`]
  if (n.asks > 0) parts.push(n.asks === 1 ? '1 with a question: ask first.' : `${n.asks} with a question: ask first.`)
  if (n.leftOut > 0) parts.push(`${n.leftOut} not printed.`)
  return parts.join(' ')
}

/** B, one page in front of a batch: the blanks and the stop list once, then a row for each paper with boxes to tick. */
export function lienHelpBatchSheetHtml(input: { papers: ReadonlyArray<LienHelpPaper>; leftOut?: ReadonlyArray<LienHelpLeftOut>; printedOn: string; extras?: LienHelpExtras }): string {
  const { papers } = input
  const leftOut = input.leftOut ?? []
  const fileBys = [...new Set(papers.map((p) => p.fileBy).filter(Boolean))]
  const tick = '<td><span class="lien-help-tick"></span></td>'
  const asks = lienHelpBatchAsks(papers)
  // The app's answers are on the sheet only when every paper carries them; a mixed batch keeps the list a reader checks by eye.
  const checked = papers.length > 0 && papers.every((p) => (p.checks?.length ?? 0) > 0)
  const counties = [...new Set(papers.map((p) => (p.signingCounty ?? '').trim()))]
  const printedCounty = counties.length === 1 && counties[0] ? counties[0] : ''
  // Who to ask: once on the sheet when every paper names the same people, on each row when they differ.
  const askWords = [...new Set(papers.map((p) => (p.ask ?? '').trim()).filter(Boolean))]
  const oneAsk = askWords.length === 1 ? (askWords[0] ?? '') : ''
  const COLS = 10
  const clerkOf = (p: LienHelpPaper): string => p.propertyCounty.trim()
  const rows = papers
    .map((p, i) => {
      // A row for the clerk whenever the county changes (change 7): the caller prints the papers in clerk order
      // (`lienAffidavitClerkOrder`), so each clerk's papers sit together and the sheet is the trip list.
      const county = clerkOf(p)
      const head =
        i === 0 || clerkOf(papers[i - 1] as LienHelpPaper) !== county
          ? `<tr class="lien-help-group" data-lien-help-clerk="${esc(county)}"><td colspan="${COLS}">${esc(lienHelpClerkGroupWords(county, papers.filter((q) => clerkOf(q) === county).length, lienHelpClerkLine(p.clerk)))}</td></tr>`
          : ''
      const note = (asks.get(i) ?? []).map((words) => `<div class="lien-help-flag">Ask first. ${esc(words)}</div>`).join('')
      const by = fileBys.length > 1 && p.fileBy ? `<br/>File by ${esc(p.fileBy)}` : ''
      const who = !oneAsk && (p.ask ?? '').trim() ? `<br/><span class="lien-help-small">${esc((p.ask ?? '').trim())}</span>` : ''
      const copyTo = [p.ownerName.trim(), p.contractorName.trim()].filter(Boolean).map(esc).join(' · ')
      return `${head}<tr><td>${i + 1}</td><td><strong>${esc(p.jobLabel)}</strong><br/>${esc(p.propertyAddress)}${by}${note}${who}</td><td>${esc(p.claim)}</td><td>${copyTo}</td><td></td>${tick.repeat(5)}</tr>`
    })
    .join('')
  const left = leftOut.map((l) => `<tr><td></td><td>${esc(l.jobLabel)}</td><td colspan="${COLS - 2}" class="lien-help-flag">Not printed. ${esc(l.reason)}</td></tr>`).join('')
  const count = papers.length
  return (
    `<section class="lien-help" data-lien-help="batch">` +
    STRIPE +
    band('Help sheet · do not file this page', count === 1 ? 'Lien affidavit: this batch of 1' : `Lien affidavits: this batch of ${count}`, [input.printedOn ? `Printed ${input.printedOn}` : '', fileBys.length === 1 ? `All due ${fileBys[0]}` : ''], input.extras) +
    `<div class="lien-help-two">` +
    (printedCounty
      ? blanksBox(lienHelpBatchBlanksTitle(true), '', LIEN_HELP_BLANKS_PRINTED_COUNTY_SHORT, lienHelpPrintedCountyLine(printedCounty), lienHelpPictureHtml(printedCounty, true), true)
      : blanksBox(lienHelpBatchBlanksTitle(false), '', LIEN_HELP_BLANKS_SHORT, '', lienHelpPictureHtml('', true), true)) +
    (checked
      ? `<div class="lien-help-box" data-lien-help-batch-checks><h3>What the app checked</h3><p><strong>${esc(lienHelpBatchSummary({ papers: papers.length, asks: asks.size, leftOut: leftOut.length }))}</strong></p><p style="margin-top:3pt">On each paper it read the owner, the homestead mark and the notice behind each month. ${asks.size > 0 ? 'A row marked <strong>Ask first</strong> waits for the attorney. ' : ''}</p><p style="margin-top:3pt"><strong>Your check.</strong> ${esc(LIEN_HELP_YOUR_CHECK)}${oneAsk ? ` <strong data-lien-help-ask-who>${esc(oneAsk)}</strong>` : ''}</p></div>`
      : stopBox('Call the office first', LIEN_HELP_STOPS_SHORT)) +
    `</div>` +
    `<div class="lien-help-box" style="overflow:hidden">${recordCodeBlock(input.extras?.recordCode, LIEN_HELP_RECORD_CODE_WORDS.batch)}<h3>After the notary, one trip for each clerk</h3><ol>${lienHelpBatchAfterSteps(Boolean(input.extras?.recordCode)).map((s) => `<li>${s}</li>`).join('')}</ol></div>` +
    `<table class="lien-help-rows"><colgroup><col style="width:3%"/><col style="width:26%"/><col style="width:9%"/><col style="width:17%"/><col style="width:13%"/><col style="width:6.4%"/><col style="width:6.4%"/><col style="width:6.4%"/><col style="width:6.4%"/><col style="width:6.4%"/></colgroup><tr><th>#</th><th>Job · property</th><th>Claim</th><th>Mail a copy to</th><th>Recording no. · day filed</th><th>Signed</th><th>Sealed</th><th>Filed</th><th>In app</th><th>Mailed</th></tr>${rows}${left}</table>` +
    foot(
      `Help sheet for the batch${input.printedOn ? ` printed ${input.printedOn}` : ''}${oneAsk && !checked ? ` · ${oneAsk}` : ''}`,
      input.extras?.recordFollows ? (count === 1 ? 'The notice record is next, then 1 paper' : `The notice records are next, then ${count} papers`) : count === 1 ? '1 paper follows this page' : `${count} papers follow this page`,
    ) +
    `</section>`
  )
}

/** A clerk's row on the batch sheet: `ALDER COUNTY CLERK · 2 papers`, then the clerk's typed facts when the office has them. */
export function lienHelpClerkGroupWords(county: string, papers: number, clerkLine = ''): string {
  const name = county.trim() ? `${county.trim().toUpperCase()} COUNTY CLERK` : 'THE CLERK OF THE PROPERTY’S COUNTY'
  return [name, papers === 1 ? '1 paper' : `${papers} papers`, clerkLine.trim()].filter(Boolean).join(' · ')
}

const num = (n: number): string => `<span class="lien-help-num">${n}</span>`

/**
 * The paper's own HTML with a numbered mark beside each blank and beside the lines to read twice. Each mark is put
 * after words the short form always prints; a paper that lacks a line (a job contracted with the owner names no
 * months and no notices) simply gets no mark there. Returns the marks that landed, so the notes list only those.
 */
export function lienHelpMarkPaper(paperHtml: string): { html: string; marks: number[] } {
  let html = paperHtml
  const marks: number[] = []
  const mark = (n: number, find: RegExp, put: (m: string) => string) => {
    if (!find.test(html)) return
    html = html.replace(find, (m) => put(m))
    if (!marks.includes(n)) marks.push(n)
  }
  // 1: the top venue's blank, the bold county line; 3: the notary's own venue blank, which is not bold.
  mark(1, /<strong>COUNTY OF _+<\/strong>/, (m) => `${m}${num(1)}`)
  mark(2, /<div style="border-bottom:1px solid currentColor;height:1\.6em"><\/div>/, (m) => `${m}${num(2)}`)
  mark(3, /STATE OF TEXAS<br\/>COUNTY OF _+<\/p>/, (m) => m.replace('</p>', `${num(3)}</p>`))
  mark(4, /SWORN TO AND SUBSCRIBED BEFORE ME on this[^<]*<\/p>/, (m) => m.replace('</p>', `${num(4)}</p>`))
  mark(5, /_{20,}<br\/>Notary Public, State of Texas<\/p>/, (m) => m.replace('</p>', `${num(5)}${num(6)}</p>`))
  if (marks.includes(5)) marks.push(6)
  mark(7, /The owner or reputed owner is[^<]*<\/p>/, (m) => m.replace('</p>', `${num(7)}</p>`))
  mark(7, /under a contract with the owner,[^<]*<\/p>/, (m) => m.replace('</p>', `${num(7)}</p>`))
  mark(8, /Payment is requested for work done[^<]*<\/p>/, (m) => m.replace('</p>', `${num(8)}</p>`))
  mark(8, /Notice of the claim was sent[^<]*<\/p>/, (m) => m.replace('</p>', `${num(8)}</p>`))
  return { html, marks: marks.sort((a, b) => a - b) }
}

/** The words across the guide copy's paper. */
export const GUIDE_WATERMARK = 'GUIDE COPY'

/** What each mark says, in the guide copy's side column. */
export const LIEN_HELP_MARK_NOTES: Readonly<Record<number, string>> = {
  1: 'The county you sign in. It is not the property’s county.',
  2: 'The signer signs here, in front of the notary.',
  3: 'The same county as mark 1.',
  4: 'The day it is signed.',
  5: 'The notary signs, and prints a name on the line under it.',
  6: 'The seal goes beside the notary’s signature, in ink that shows on a copy.',
  7: 'A person or a company. Never ATTN, never a city, never someone who lives in the house.',
  8: 'Every month has a notice mailed on time, to the owner and to the contractor.',
}

/**
 * C, a guide copy of the paper itself: the paper's HTML with marks, the notes beside it, and a band at the top and the
 * foot that says this page is never signed or filed. `paperHtml` is the paper as the screen draws it (`filingDocHtml`).
 */
export function lienHelpGuideCopyHtml(paperHtml: string, p: Pick<LienHelpPaper, 'jobLabel' | 'fileBy' | 'propertyCounty' | 'contractorName'> & Partial<Pick<LienHelpPaper, 'ask'>>, extras?: LienHelpExtras): string {
  const landed = lienHelpMarkPaper(paperHtml)
  // The marks count 1, 2, 3 in the order the pen meets them, whichever landed: a paper with its counties printed has no
  // county blanks, and a reader who sees 2, 4, 5 goes looking for 1 and 3.
  const shown = new Map(landed.marks.map((n, i) => [n, i + 1]))
  const marked = { marks: landed.marks, html: landed.html.replace(/<span class="lien-help-num">(\d+)<\/span>/g, (m, n: string) => (shown.has(Number(n)) ? num(shown.get(Number(n)) as number) : m)) }
  const note = (n: number) => (shown.has(n) ? `<p>${num(shown.get(n) as number)}${esc(LIEN_HELP_MARK_NOTES[n] ?? '')}</p>` : '')
  const blanks = [1, 2, 3, 4, 5, 6].map(note).join('')
  const reads = [7, 8].map(note).join('')
  const bandWords = 'Guide copy · do not sign or file this page'
  return (
    `<section class="lien-help" data-lien-help="guide">` +
    STRIPE +
    band(bandWords, 'Where the pen goes on the paper', [p.jobLabel, p.fileBy ? `File by ${p.fileBy}` : ''], extras) +
    `<div class="lien-help-guide">` +
    // GUIDE COPY across the paper (change 11): pale enough to read through, plain enough that nobody signs this page.
    `<div class="lien-help-guide-paper lien-help-watermarked">${marked.html}<div class="lien-help-watermark" data-lien-help-watermark aria-hidden="true">${GUIDE_WATERMARK}</div></div>` +
    `<div>` +
    `<div class="lien-help-box"><h3>What goes in each blank</h3>${blanks}</div>` +
    (reads ? `<div class="lien-help-box lien-help-stop"><h3>Read these lines</h3>${reads}<p class="lien-help-small">If either is wrong, call the office. Do not sign. ${esc(LIEN_HELP_NEVER_FIX)}</p></div>` : '') +
    `<div class="lien-help-box"><h3>After it is signed</h3><ol>${lienHelpAfterStepsShort(p.propertyCounty, Boolean(p.contractorName.trim())).map((s) => `<li>${s}</li>`).join('')}</ol></div>` +
    `</div></div>` +
    `<div class="lien-help-band" style="margin:8pt 0 0;align-items:center"><div><div class="lien-help-tag">${esc(bandWords)}</div><div class="lien-help-small">Print the paper itself with Print for notarization.${(p.ask ?? '').trim() ? ` ${esc((p.ask ?? '').trim())}` : ''}</div></div></div>` +
    `</section>`
  )
}

/** A whole print page for a help sheet printed alone (the guide copy): light, letter, with the sheet's styles. */
export function lienHelpPrintHtml(sectionHtml: string, title: string): string {
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page { size: letter; margin: 0.5in; } body { margin: 0; background: #fff; }${LIEN_HELP_STYLES} @media print { .lien-help { margin: 0; break-after: auto; page-break-after: auto; } }</style></head><body>${sectionHtml}</body></html>`
}

/** The facts a help sheet reads off an affidavit's own fields, so the sheet and the paper cannot disagree. */
export function lienHelpPaperFromFields(input: {
  jobLabel: string
  fileBy: string
  claimWords: string
  fields: { county: string; propertyAddress: string; claimantPersonName: string; ownerName: string; ownerAddress: string; originalContractorName: string; originalContractorAddress: string; isSub?: boolean; workMonthsWords?: string; signingCounty?: string }
  /** What the desk knows of the property and the notices, for the checks; absent, the sheet keeps its list of warnings. */
  checked?: { propertyKind: string | null | undefined; homestead: boolean; noticeLines: ReadonlyArray<string> }
  /** The property's county clerk as Settings hold it; absent, the sheet names the clerk and no more. */
  clerk?: LienHelpClerk
  /** Who to ask about this job (`lienAskFor`). */
  ask?: string
}): LienHelpPaper {
  const f = input.fields
  const sub = f.isSub !== false
  const signingCounty = signingCountyWords(f.signingCounty)
  return {
    ...(input.checked
      ? { checks: lienHelpChecks({ ownerName: f.ownerName, propertyKind: input.checked.propertyKind, homestead: input.checked.homestead, isSub: sub, monthsWords: f.workMonthsWords ?? '', noticeLines: input.checked.noticeLines, contractorName: f.originalContractorName }) }
      : {}),
    ...(signingCounty ? { signingCounty } : {}),
    ...(input.clerk ? { clerk: input.clerk } : {}),
    ...((input.ask ?? '').trim() ? { ask: (input.ask ?? '').trim() } : {}),
    jobLabel: input.jobLabel,
    propertyAddress: f.propertyAddress.trim(),
    propertyCounty: f.county.trim(),
    claim: input.claimWords,
    fileBy: input.fileBy,
    signer: f.claimantPersonName.trim(),
    ownerName: f.ownerName.trim(),
    ownerAddress: f.ownerAddress.trim(),
    contractorName: sub ? f.originalContractorName.trim() : '',
    contractorAddress: sub ? f.originalContractorAddress.trim() : '',
  }
}
