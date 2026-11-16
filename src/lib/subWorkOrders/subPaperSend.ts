/**
 * Sending sub papers (punch list #350, PR 5): the words of the send window. Who it goes to, the real message, the
 * files, what the press does and the press's own label with its count. One window sends all three papers.
 *
 * Email carries the PDFs. A text carries a link to the same papers on the sub's page, never a file. A sub with no
 * email on the roster gets a line that says so and a door to add one: the press is dead, never silent.
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
}

/**
 * The plan for one send. `lead` is the paper the window was opened on; `attached` ride along. `portalUrl` is the
 * sub's own page, when they have one.
 */
export function subPaperSendPlan(i: { company: string; subName: string; lead: SubPaper; attached: readonly SubPaper[]; by: SubPaperSendBy; email: string | null; phone: string | null; portalUrl: string | null; lastPayment: { amount: number; day: string } | null }): SubPaperSendPlan {
  const papers = [i.lead, ...i.attached]
  const files = papers.map(subPaperAttachmentName)
  const page = i.portalUrl ? ` The same papers are on your page: ${i.portalUrl}` : ''
  let subject: string
  let lines: string[]
  if (i.lead.kind === 'statement_of_account') {
    subject = `Your statement of account from ${i.company}`
    lines = [`Here is your statement for ${i.lead.period}.`, `We still have ${paperMoney(i.lead.stillOpen)} open with you.`, i.lastPayment ? `Our last payment was ${paperMoney(i.lastPayment.amount)} on ${i.lastPayment.day}.` : '']
  } else if (i.lead.kind === 'payment_record') {
    subject = `Payment record${i.lead.number ? ` ${i.lead.number}` : ''} from ${i.company}`
    lines = [`We sent you ${paperMoney(i.lead.amountSent)} on ${i.lead.sentOn}${i.lead.how && i.lead.how !== 'Not recorded' ? ` by ${i.lead.how}` : ''}.`, `The record shows how much went to each statement.`, i.lead.stillOpenAfter > 0 ? `${paperMoney(i.lead.stillOpenAfter)} is still open with you after it.` : 'Nothing is still open with you after it.']
  } else {
    subject = `Work statement${i.lead.number ? ` ${i.lead.number}` : ''} from ${i.company}`
    lines = [`Here is our statement of your work on ${i.lead.job.label}.`, `It comes to ${paperMoney(i.lead.comesTo)}.`, i.lead.stillOpen > 0 ? `${paperMoney(i.lead.stillOpen)} is still open on it.` : 'It is paid in full.']
  }
  const body = `Hi ${i.subName}. ${lines.filter(Boolean).join(' ')}${page}`
  const text = `${i.company}: ${subject.replace(` from ${i.company}`, '')}. ${lines.filter(Boolean)[1] ?? ''} ${i.portalUrl ?? ''}`.trim()
  const count = plural(papers.length, 'paper', 'papers')
  if (i.by === 'email') {
    const blocked = i.email ? null : `${i.subName} has no email on the roster. Add one on People → Subs, or text a link.`
    return { subject, body, text, files, steps: [`The ${papers.length === 1 ? 'PDF is' : 'PDFs are'} made${papers.some((p) => !p.number) ? ' and numbered' : ''}.`, `The email goes to ${i.email ?? 'their address'} with ${plural(files.length, 'file', 'files')}.`, 'A copy is filed under Sent copies, on the sub and on each job.'], confirmLabel: blocked ? null : `Send ${count} by email`, blocked }
  }
  if (i.by === 'text') {
    const blocked = !i.portalUrl ? `${i.subName} has no page to link to yet. Open their portal link on People → Subs first.` : i.phone ? null : `${i.subName} has no phone on the roster. Add one on People → Subs, or send by email.`
    return { subject, body, text, files: [], steps: [`The ${papers.length === 1 ? 'paper is' : 'papers are'} put on their page.`, `A text with the link goes to ${i.phone ?? 'their phone'}.`, 'A copy is filed under Sent copies, on the sub and on each job.'], confirmLabel: blocked ? null : `Text a link to ${count}`, blocked }
  }
  const blocked = i.portalUrl ? null : `${i.subName} has no page to link to yet. Open their portal link on People → Subs first.`
  return { subject, body, text, files: [], steps: ['The link is copied. Nothing is sent, and nothing is filed.'], confirmLabel: blocked ? null : 'Copy the link', blocked }
}
