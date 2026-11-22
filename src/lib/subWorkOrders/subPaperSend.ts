/**
 * Sending sub papers (punch list #350, PR 5): the words of the send window. Who it goes to, the real message, the
 * files, what the press does and the press's own label with its count. One window sends all three papers.
 *
 * Email carries the PDFs. A text carries a link to the same papers on the sub's page, never a file. A sub with no
 * email on the roster gets a line that says so and a door to add one: the press is dead, never silent.
 *
 * Email is the one way built (`send-sub-paper-email`). The texted link and the copied link keep their words here
 * for the day they are, and a window offers only the ways it is handed.
 *
 * One email carries `SUB_PAPER_SEND_MAX` papers, the function's own limit. `subPaperSendSet` says which ride and
 * which are held, so the press sends what fits and names the rest: a send is never refused whole for one too many.
 * `subPaperSendParts` cuts the whole pick into the emails it takes, so the held papers have an email of their own.
 *
 * Pure: no React, no Supabase.
 */
import { paperMoney, type PaymentRecord, type StatementOfAccount, type WorkStatement } from '../../../supabase/functions/_shared/subPapers'

export type SubPaper = WorkStatement | PaymentRecord | StatementOfAccount

export type SubPaperSendBy = 'email' | 'text' | 'link'

export const SUB_PAPER_SEND_BY: ReadonlyArray<{ key: SubPaperSendBy; label: string; hint: string }> = [
  { key: 'email', label: 'Email', hint: 'Email carries the PDFs.' },
  { key: 'text', label: 'Text a link', hint: "A text carries a link to the same papers on the sub's page." },
  { key: 'link', label: 'Copy the link', hint: "Copies the link to the sub's page. Nothing is sent." },
]

/** The sent-copy kind each paper is filed under. */
export const SUB_PAPER_SENT_KIND: Record<SubPaper['kind'], string> = {
  work_statement: 'sub_work_statement',
  payment_record: 'sub_payment_record',
  statement_of_account: 'sub_statement_of_account',
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** One email carries this many papers at most. `send-sub-paper-email` refuses more (its `MAX_PAPERS`). */
export const SUB_PAPER_SEND_MAX = 12

/**
 * What one email carries: the paper the window is on, then what rides along, in the order given, up to the limit.
 * What does not fit is held, and the window names it: nothing is left off without a word.
 */
export function subPaperSendSet(attached: readonly SubPaper[], max: number = SUB_PAPER_SEND_MAX): { attached: SubPaper[]; held: SubPaper[] } {
  const room = Math.max(0, max - 1)
  return { attached: attached.slice(0, room), held: attached.slice(room) }
}

/**
 * A pick of papers as the emails it takes: the paper the window is on leads the first, and each email carries the
 * limit at most, in the order given. The first is what `subPaperSendSet` says rides. Each later one holds papers
 * that did not fit, and its first paper leads it. Nothing is in two emails and nothing is left out.
 */
export function subPaperSendParts(lead: SubPaper, attached: readonly SubPaper[], max: number = SUB_PAPER_SEND_MAX): SubPaper[][] {
  const all = [lead, ...attached]
  const size = Math.max(1, Math.floor(max))
  const parts: SubPaper[][] = []
  for (let i = 0; i < all.length; i += size) parts.push(all.slice(i, i + size))
  return parts
}

/** Which email of how many this send is, counted from 1. Absent or `{ n: 1 }` is the first. */
export type SubPaperSendPart = { n: number; of: number }

/**
 * What a paper is called in a line of words: its number, else what it is. A work statement with no number names
 * its sheet's day too, since two sheets of one job would read alike without it.
 */
function paperName(p: SubPaper): string {
  if (p.number) return p.number
  if (p.kind === 'statement_of_account') return 'the statement of account'
  if (p.kind === 'payment_record') return `the payment record of ${p.sentOn}`
  return `the work statement for ${p.job.label}${p.job.day ? ` of ${p.job.day}` : ''}`
}

/** `WS-2041-1.pdf`, `PR-0231 Payment record.pdf`; a paper with no number yet is named for what it is. */
export function subPaperAttachmentName(p: SubPaper): string {
  const number = p.number
  if (p.kind === 'statement_of_account') return `${number ? `${number} ` : ''}Statement of account.pdf`
  if (p.kind === 'payment_record') return `${number ? `${number} ` : ''}Payment record${number ? '' : ` ${p.sentOn}`}.pdf`
  return `${number || `Work statement ${p.job.label}`}.pdf`.replace(/[\\/:#]/g, '')
}

export function subPaperTitle(p: SubPaper): string {
  if (p.kind === 'statement_of_account') return `Statement of account · ${p.sub.name} · ${p.period}`
  if (p.kind === 'payment_record') return `Payment record${p.number ? ` ${p.number}` : ''} · ${p.sub.name} · ${paperMoney(p.amountSent)}`
  return `Work statement${p.number ? ` ${p.number}` : ''} · ${p.sub.name} · ${p.job.label}`
}

/**
 * The subject of the email a paper leads. A work statement and a payment record name their number once they have
 * one; a statement of account reads the same either way.
 *
 * The send step draws it from the paper as previewed, and a sheet's first work statement has no number until the
 * press registers it. So the send builds it again from the paper as numbered: the subject then names the number
 * on the file beside it.
 *
 * An email after the first carries only papers that did not fit, so it names itself and not its first paper.
 */
export function subPaperSendSubject(lead: SubPaper, company: string, part: SubPaperSendPart | null = null): string {
  if (part && part.n > 1) return `More papers from ${company}, email ${part.n} of ${part.of}`
  if (lead.kind === 'statement_of_account') return `Your statement of account from ${company}`
  if (lead.kind === 'payment_record') return `Payment record${lead.number ? ` ${lead.number}` : ''} from ${company}`
  return `Work statement${lead.number ? ` ${lead.number}` : ''} from ${company}`
}

export type SubPaperSendPlan = {
  subject: string
  /** The message as the sub reads it. */
  body: string
  /** The text of a texted link. */
  text: string
  files: string[]
  /** What happens on the press, in order. */
  steps: string[]
  /** The press, with its count. Null when it cannot go, and `blocked` says why. */
  confirmLabel: string | null
  blocked: string | null
  /** What a dead press waits on, for the window to draw its door: an address on the roster. Null when it can go. */
  needs: 'email' | null
  /** The papers that do not fit in this email, in one line. Null when everything rides. */
  held: string | null
  /** The press that opens the email the held papers go in, with its count. Null when nothing is held. */
  next: string | null
  /** Which email of how many this one is. Null when one email carries everything. */
  part: SubPaperSendPart | null
}

/**
 * The plan for one send. `lead` is the paper the window was opened on; `attached` ride along. `portalUrl` is the
 * sub's own page, when they have one. `emailUnread` is a roster the window could not read just now.
 */
export function subPaperSendPlan(i: { company: string; subName: string; lead: SubPaper; attached: readonly SubPaper[]; held?: readonly SubPaper[]; part?: SubPaperSendPart | null; by: SubPaperSendBy; email: string | null; emailUnread?: boolean; phone: string | null; portalUrl: string | null; lastPayment: { amount: number; day: string } | null }): SubPaperSendPlan {
  const papers = [i.lead, ...i.attached]
  const files = papers.map(subPaperAttachmentName)
  const page = i.portalUrl ? ` The same papers are on your page: ${i.portalUrl}` : ''
  const part = i.part && i.part.of > 1 ? i.part : null
  const subject = subPaperSendSubject(i.lead, i.company, part)
  let lines: string[]
  if (part && part.n > 1) {
    lines = [`Here ${papers.length === 1 ? 'is 1 more paper' : `are ${papers.length} more papers`} from us.`, `${papers.length === 1 ? 'It' : 'They'} did not fit in our last email.`]
  } else if (i.lead.kind === 'statement_of_account') {
    // `To date, Nov 19, 2026` and `To Nov 13, 2026` follow the word straight: *your statement to date, Nov 19, 2026*.
    const period = /^To /.test(i.lead.period) ? ` t${i.lead.period.slice(1)}` : ` for ${i.lead.period}`
    lines = [`Here is your statement${period}.`, `We still have ${paperMoney(i.lead.stillOpen)} open with you.`, i.lastPayment ? `Our last payment was ${paperMoney(i.lastPayment.amount)} on ${i.lastPayment.day}.` : '']
  } else if (i.lead.kind === 'payment_record') {
    lines = [`We sent you ${paperMoney(i.lead.amountSent)} on ${i.lead.sentOn}${i.lead.how && i.lead.how !== 'Not recorded' ? ` by ${i.lead.how}` : ''}.`, `The record shows how much went to each statement.`, i.lead.stillOpenAfter > 0 ? `${paperMoney(i.lead.stillOpenAfter)} is still open with you after it.` : 'Nothing is still open with you after it.']
  } else {
    lines = [`Here is our statement of your work on ${i.lead.job.label}.`, `It comes to ${paperMoney(i.lead.comesTo)}.`, i.lead.stillOpen > 0 ? `${paperMoney(i.lead.stillOpen)} is still open on it.` : 'It is paid in full.']
  }
  const body = `Hi ${i.subName}. ${lines.filter(Boolean).join(' ')}${page}`
  const text = `${i.company}: ${subject.replace(` from ${i.company}`, '')}. ${lines.filter(Boolean)[1] ?? ''} ${i.portalUrl ?? ''}`.trim()
  const count = plural(papers.length, 'paper', 'papers')
  if (i.by === 'email') {
    // An address the window could not read is not a missing one: the function reads the roster itself, so the press stays live.
    const blocked = i.email || i.emailUnread ? null : `${i.subName} has no email on the roster, so there is nowhere to send ${papers.length === 1 ? 'it' : 'them'}.`
    const left = i.held ?? []
    // The held papers are the email's alone: a link opens the sub's whole page, so nothing is left off one.
    const held = left.length === 0 ? null : `${plural(left.length, 'more paper does', 'more papers do')} not fit, since one email carries ${SUB_PAPER_SEND_MAX}. Send ${left.length === 1 ? 'it' : 'them'} next: ${left.map(paperName).join(', ')}.`
    // The next email carries the limit at most, so its count is what that press opens, not all that is held.
    const next = left.length === 0 ? null : `Open the next email, ${plural(Math.min(left.length, SUB_PAPER_SEND_MAX), 'paper', 'papers')}`
    return { subject, body, text, files, next, part, steps: [`The ${papers.length === 1 ? 'PDF is' : 'PDFs are'} made${papers.some((p) => !p.number) ? ' and numbered' : ''}.`, `The email goes to ${i.email ?? (i.emailUnread ? 'the address on their roster row' : 'their address')} with ${plural(files.length, 'file', 'files')}.`, 'A copy is filed under Sent copies, on the sub and on each job.'], confirmLabel: blocked ? null : `Send ${count} by email`, blocked, needs: blocked ? 'email' : null, held }
  }
  if (i.by === 'text') {
    const blocked = !i.portalUrl ? `${i.subName} has no page to link to yet. Open their portal link on People → Subs first.` : i.phone ? null : `${i.subName} has no phone on the roster. Add one on People → Subs, or send by email.`
    return { subject, body, text, files: [], steps: [`The ${papers.length === 1 ? 'paper is' : 'papers are'} put on their page.`, `A text with the link goes to ${i.phone ?? 'their phone'}.`, 'A copy is filed under Sent copies, on the sub and on each job.'], confirmLabel: blocked ? null : `Text a link to ${count}`, blocked, needs: null, held: null, next: null, part: null }
  }
  const blocked = i.portalUrl ? null : `${i.subName} has no page to link to yet. Open their portal link on People → Subs first.`
  return { subject, body, text, files: [], steps: ['The link is copied. Nothing is sent, and nothing is filed.'], confirmLabel: blocked ? null : 'Copy the link', blocked, needs: null, held: null, next: null, part: null }
}

/**
 * The door for a sub with no email on the roster, in the window's words. The function sends to the roster's own
 * address and nowhere else, so the press waits on that row. The paper itself does not: Print and Download work.
 */
export function subPaperEmailDoor(): { words: string } {
  return { words: 'Print or download the paper for now. A dev can add an email to their roster row.' }
}

/** What the window says once the email went: how many, to whom and where, and where the copies are. */
export function subPaperSentWords(i: { count: number; subName: string; to: string | null }): string {
  return `Sent ${plural(i.count, 'paper', 'papers')} to ${i.subName}${i.to ? ` at ${i.to}` : ''}. ${i.count === 1 ? 'A copy is' : 'The copies are'} under Documents → Sent copies.`
}

/**
 * What the window says when no answer came back: the request left and the function may have mailed the papers
 * before the line dropped. It claims neither, and says where to look before a second send.
 */
export function subPaperSendUnknownWords(): string {
  return 'No answer came back, so it is not known whether the email went. Look under Documents → Sent copies before you send again.'
}

/**
 * What the window says when the email did not go. A statement of account takes a new number every time it is
 * made, so one that was numbered for this send is named: the office knows that number went nowhere.
 */
export function subPaperNotSentWords(i: { reason: string; numbered: readonly SubPaper[] }): string {
  const spent = i.numbered.filter((p) => p.kind === 'statement_of_account' && p.number).map((p) => p.number)
  const reason = i.reason.trim().replace(/[.\s]+$/, '')
  return `Nothing was sent: ${reason || 'no reason was given'}.${spent.length > 0 ? ` ${spent.join(' and ')} took ${spent.length === 1 ? 'its number' : 'their numbers'} and did not go. The next send takes a new one.` : ''}`
}
