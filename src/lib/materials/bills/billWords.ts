/**
 * Supply-house bill capture (punch list #179 PR 2, v2.6088): every sentence the form shows about a fill, in the words
 * of the approved drawing. A first-timer reads these, so each follows `plainWords.ts`: one idea a sentence, none over
 * twenty words, no dash, semicolon, parenthesis or dot list inside one (`billWords.test.ts` holds them). The words
 * read, guessed and typed never appear here: the form shows three looks, and these sentences say what to do.
 */
import type { SupplyDocumentKind } from '../supplyHouseInvoiceForm'
import type { DuplicateHit, SumCheck } from './billChecks'
import type { DueGuess, JobEvidence, JobGuess } from './billMatch'

export const dollars = (cents: number): string => `$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 22" from a YYYY-MM-DD; '' when malformed. */
export function dayWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  return m ? `${MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[3])}` : ''
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

// ---------- The bill, the form's first question ----------

export const START_WORDS = {
  section: 'The bill',
  startFrom: 'Start from:',
  anotherFile: 'Another file…',
  noPdf: 'No PDF, I will type it',
  drop: 'Drop the bill here, or pick it. A PDF or a picture of the counter ticket. It is kept with the invoice and becomes the row’s View.',
  reading: 'Reading the paper…',
} as const

/** A thread file's chip: "S1183420.pdf · Oct 22, on the thread". A label, not a sentence. */
export function threadChip(name: string, dateYmd: string): string {
  const day = dayWords(dateYmd)
  return day ? `${name} · ${day}, on the thread` : `${name}, on the thread`
}

/** The three looks, under the fields. */
export const LEGEND = { paper: 'from the paper', guess: 'a guess, check it', yours: 'yours to set' } as const

/**
 * The line under the picker that counts what is left: the guesses marked below, the fields the paper cannot answer,
 * the fields the person typed over.
 */
export function countLine(n: { checks: number; yours: number; typed: number }): string {
  const words = (k: number) => (k === 1 ? 'One thing' : k === 2 ? 'Two things' : k === 3 ? 'Three things' : `${k} things`)
  const yours = n.yours === 0 ? '' : ` ${words(n.yours)} ${n.yours === 1 ? 'is' : 'are'} yours to set.`
  const kept = n.typed === 0 ? '' : n.typed === 1 ? ' One field you typed is kept.' : ` ${n.typed} fields you typed are kept.`
  if (n.checks === 0) return `Filled in from the PDF. Nothing left to check.${yours}${kept} Press Save when it reads right.`
  return `Filled in from the PDF. ${words(n.checks)} to check, marked below.${yours}${kept} Change anything you like. What you type stays.`
}

export const NO_PDF_LINE = 'Nothing filled in. Type the bill from the paper, as today.'

// ---------- The checks, as sentences under the field ----------

/** Under Amount: the lines add to the total, or they do not. Null when there is nothing to add up. */
export function sumWords(check: SumCheck, kind: SupplyDocumentKind): { tone: 'right' | 'off'; line: string; presses: { useSum: string; keepTotal: string } | null } | null {
  if (check.kind === 'none') return null
  const lines = count(check.lineCount, 'line', 'lines')
  const paper = kind === 'credit' ? 'credit' : 'total'
  const tax = check.withTax ? ' with the tax' : ''
  if (check.kind === 'right') {
    const kept = check.lineCount === 1 ? `The line is kept with the ${kind === 'credit' ? 'credit' : 'invoice'}.` : `The lines are kept with the ${kind === 'credit' ? 'credit' : 'invoice'}.`
    return { tone: 'right', line: `The ${lines} on the paper ${check.lineCount === 1 ? 'adds' : 'add'} up to ${dollars(check.totalCents)}${tax}, so the ${paper} is right. ${kept}`, presses: null }
  }
  return {
    tone: 'off',
    line: `The paper prints ${dollars(check.totalCents)}, and its ${lines} ${check.lineCount === 1 ? 'adds' : 'add'} up to ${dollars(check.sumCents)}${tax}. One of the two is off.`,
    presses: { useSum: `Use ${dollars(check.sumCents)}`, keepTotal: `Keep ${dollars(check.totalCents)}` },
  }
}

/** Under Invoice #: a number already on this house's list. */
export function duplicateWords(hit: DuplicateHit, houseName: string): { line: string; press: string } {
  const when = dayWords(hit.dateYmd)
  return { line: `${hit.number} is already on ${houseName}’s list, ${when}, ${dollars(hit.amountCents)}. This may be the same bill twice.`, press: 'Open it' }
}

/** Under Invoice #, in red: the letterhead names another house. */
export function houseWords(readName: string, houseName: string): string {
  return `This reads as a bill from ${readName}, not ${houseName}. Open their row to record it there, or save it here if the paper is theirs.`
}

/** Under the picker: a statement, several invoices in one PDF. */
export function statementWords(numbers: readonly string[]): string {
  const listed = numbers.length > 0 ? ` listing ${count(numbers.length, 'invoice', 'invoices')}: ${numbers.join(', ')}` : ''
  return `This is a statement${listed}. One bill at a time: pick each from the thread, or type the ones that are not there.`
}

// ---------- The guesses, with a Yes ----------

const evidenceWords: Record<JobEvidence, (g: JobGuess) => string> = {
  code: (g) => `PO ${g.code}`,
  account: () => 'the account reference',
  shipTo: () => 'the ship-to address',
  jobText: () => 'the job name on the paper',
}

/** The amber card under Which job: the job is a guess, from what, with a Yes. */
export function jobGuessWords(guess: JobGuess, jobLabel: string): { title: string; check: string; line: string; yes: string; another: string } {
  const from = guess.evidence.map((e) => evidenceWords[e](guess))
  const joined = from.length <= 1 ? from[0] ?? 'what the paper prints' : `${from.slice(0, -1).join(', ')} and ${from[from.length - 1]}`
  return {
    title: jobLabel,
    check: 'Check this',
    line: `The paper names no job. ${jobLabel.split(' · ')[0]} is a guess from ${joined}. Right job?`,
    yes: `Yes, ${jobLabel.split(' · ')[0]}`,
    another: 'Pick another job',
  }
}

/** The card once the person said yes. */
export function jobSettledWords(jobLabel: string): { check: string; line: string } {
  return { check: 'Yours', line: `${jobLabel}, as you said.` }
}

/** A credit's job: not a guess, the invoice it credits carries it. */
export function jobFromPairWords(jobLabel: string, invoiceNumber: string): { check: string; line: string } {
  return { check: 'From the invoice it credits', line: `${jobLabel.split(' · ')[0]} is the job on ${invoiceNumber}, the invoice this credit names. The parts go back off that job.` }
}

/** Beside the job-account tick when it was guessed on from an open account. */
export function jobAccountGuessWords(houseName: string): { label: string; why: string } {
  return { label: `On ${houseName}’s job account`, why: 'A guess, since the account is open. Untick if this bill is not on it.' }
}

/** Under Credits invoice…: the pair read from the RE: line, with a Yes. */
export function pairGuessWords(invoiceNumber: string): { line: string; yes: string; another: string } {
  return { line: `The paper says RE: invoice ${invoiceNumber}, which is on this house’s list. Right invoice?`, yes: 'Yes', another: 'Pick another' }
}

/** Under Credits invoice… when the RE: line names a number not on the list. */
export function pairMissingWords(invoiceNumber: string): string {
  return `The paper says RE: invoice ${invoiceNumber}, which is not on this house’s list. Pick the invoice it credits, or leave it unpaired.`
}

/** Under Due date: where the day came from. */
export function dueWords(due: DueGuess, houseName: string, paymentDay: number | null | undefined, kind: SupplyDocumentKind): string | null {
  if (kind === 'credit') return 'A credit has no due date. Leave it blank.'
  const usual = paymentDay ? ` The house’s usual day is the ${ordinal(paymentDay)}.` : ''
  if (due.from === 'terms') return `Net ${due.days} on the paper.${usual}`
  if (due.from === 'receipt') return `Due on receipt on the paper.${usual}`
  if (due.from === 'house') return `${houseName}’s payment day is the ${ordinal(paymentDay ?? 0)}. The paper prints no terms.`
  return null
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const last = n % 10
  return `${n}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`
}

export const STATUS_YOURS = 'yours to set'

// ---------- Paperwork ----------

/** Under Paperwork: our copy is the row's link. */
export function paperworkWords(kind: SupplyDocumentKind, fileName: string, fromThread: boolean): { line: string; press: string } {
  const label = kind === 'credit' ? 'Credit PDF' : 'Invoice PDF'
  return { line: `${label}: ${fileName}, our copy${fromThread ? ' from the thread' : ''}.`, press: 'Use a Drive link instead' }
}

/** Beside the PDF pane. */
export const PDF_PANE_NOTE = 'The bill, beside the form while you check it. It becomes the row’s View on Save.'

// ---------- The doors ----------

/** The thread's offer under a line with a bill, the W-9 offer's shape. */
export function billOfferWords(houseName: string): { line: string; record: string; notABill: string; notABillTitle: string } {
  return { line: `This reads like a bill from ${houseName}.`, record: 'Record this bill', notABill: 'Not a bill', notABillTitle: 'Takes the offer away for everyone. The file stays on the line.' }
}

/** The line a Not a bill answer leaves under the file: "Not a bill · Marisol, Oct 29". A label, not a sentence. */
export function notABillWords(by: string, dateYmd: string): string {
  const tail = [by, dayWords(dateYmd)].filter(Boolean).join(', ')
  return tail ? `Not a bill · ${tail}` : 'Not a bill'
}

/** The house's row: how many files on its thread wait to be recorded, and the press. */
export function billsToRecordWords(n: number): { pill: string; press: string } | null {
  if (n <= 0) return null
  return { pill: count(n, 'bill to record', 'bills to record'), press: n === 1 ? 'Record it' : 'Record them' }
}
