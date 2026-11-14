/**
 * Bill Customer's three faces (punch list #343, PR 2). The box on the Stripe tab was headed *What the customer will
 * see* and drew the bill's own facts. The office never saw the email or the text before it went. The box now has three
 * faces: **The bill** (the same box, untouched), **The email** and **The text**. The email is built by the send's own
 * builder (`buildStripeBillEmail`, the one `send-stripe-invoice` calls) from this bill's facts, before the bill exists.
 * The text is the Billed line the Tell the customer sheet would open on, by that sheet's own rules: the office's line
 * on the step or the app's, the same fills, the same number, the same holds. Two things do not exist until the bill is
 * made, the pay link and Stripe's PDF, and the faces say so. Pure; the text's reads are `billCustomerFacesIo.ts`, the
 * drawing is `components/jobs/BillCustomerFaces.tsx`.
 */
import { buildStripeBillEmail } from '../../../supabase/functions/_shared/stripeBillEmail'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { COMPANY_EMAIL_FROM_LABEL } from '../customerEmailFrom'
import type { RecipientLine } from '../messages/compose'
import { numberChoices } from '../messages/toChip'
import { phoneContact } from '../phoneContact'
import type { QuickReply } from '../quickReplies/kernel'
import type { PortalLang } from '../gc/portalI18n'
import { firstWord, holdWords, lineFor, tellFills, tellHold, tellWords } from '../tellCustomer/tellCustomer'

export type BillFace = 'bill' | 'email' | 'text'
export const BILL_FACES: readonly BillFace[] = ['bill', 'email', 'text']

/** A pay link in the real one's shape. It opens nothing: the real one is made with the bill. */
export const SAMPLE_BILL_PAY_LINK = 'https://my.clickplumbing.com/pay/sample'

export const BILL_FACE_WORDS = {
  heading: (who: string | null) => `What ${who ?? 'the customer'} will get`,
  pill: { bill: 'The bill', email: 'The email', text: 'The text' } as Record<BillFace, string>,
  from: 'From',
  to: 'To',
  subject: 'Subject',
  frameTitle: 'The bill email as it will read',
  /** Under the email: what the picture cannot hold yet. */
  emailNote: 'Drawn from this bill by the builder the send uses. The Pay now button works once the bill is made. Stripe’s PDF rides along. A customer with a portal also gets the code to their statement.',
  emailNeedsAmount: 'The email shows once the bill has an amount and a due day.',
  textLoading: 'Reading the text…',
  textFailed: 'The text could not be read. The next screen still shows it before it goes.',
  textTo: (number: string | null) => (number ? `Text to ${number}` : 'Their number is read on the next screen.'),
  /** Under the text: it is the office's choice, on the next screen. */
  textNote: 'A text is your choice on the next screen. This press does not send it. The link shown is a sample.',
  officeLine: 'The office’s Billed line, filled for this bill.',
  appLine: 'The app’s own Billed line, filled for this bill.',
} as const

// ---------- the email ----------

export interface BillEmailFaceInput {
  /** Who the bill is addressed to, as the composed job names them. */
  payerName: string | null | undefined
  toEmail: string | null | undefined
  /** The service address, the customer's own words for the job. */
  jobAddress: string | null | undefined
  /** Stripe's number from the preview when it has run; '' before. */
  invoiceNumber: string | null | undefined
  /** What the customer owes on this bill, in cents: the preview's amount remaining. */
  amountDueCents: number
  /** The due day as the window holds it, `YYYY-MM-DD`. */
  dueYmd: string | null | undefined
  /** True when a signed-in person sends it, so a reply reaches them. */
  canReply: boolean
}

export interface BillEmailFace {
  from: string
  to: string
  subject: string
  html: string
}

/** The due day as Stripe will hold it: the end of that day in the app's calendar, the same instant `formatDueDate` reads back as that day. */
function dueUnix(ymd: string | null | undefined): number | null {
  const s = (ymd ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const ms = Date.parse(`${s}T18:00:00Z`)
  return Number.isNaN(ms) ? null : ms / 1000
}

/** The bill email as it will read, or null while the bill has no amount to show. */
export function billEmailFace(input: BillEmailFaceInput): BillEmailFace | null {
  if (!Number.isFinite(input.amountDueCents) || input.amountDueCents <= 0) return null
  const email = buildStripeBillEmail({
    companyName: PORTAL_COMPANY.name,
    companyPhone: PORTAL_COMPANY.phone,
    payerName: (input.payerName ?? '').trim(),
    jobAddress: (input.jobAddress ?? '').trim(),
    invoiceNumber: (input.invoiceNumber ?? '').trim(),
    amountDueCents: Math.round(input.amountDueCents),
    dueDateUnix: dueUnix(input.dueYmd),
    // No bill yet, so no pay page: the frame takes no clicks, and the note under it says the button works once the bill is made.
    payUrl: SAMPLE_BILL_PAY_LINK,
    invoicePdfUrl: null,
    pdfAttached: true,
    portalUrl: null,
    qrImgSrc: null,
    canReply: input.canReply,
  })
  return { from: COMPANY_EMAIL_FROM_LABEL, to: (input.toEmail ?? '').trim(), subject: email.subject, html: email.html }
}

// ---------- the text ----------

/** What the reads hand back: the job as the sheet reads it, the office's lines, the switch, the sender, and the customer's numbers. */
export interface BillTextFaceRead {
  job: { customerId: string | null; customerName: string | null; jobName: string | null; jobAddress: string | null; lang: PortalLang; portalUrl?: string | null }
  lines: readonly QuickReply[]
  textsOn: boolean
  me: string | null
  /**
   * Their numbers and the thread's texts, read without making anything. Null when the customer has no contact yet: the
   * next screen makes one from the customer, so this face cannot know the number and says so.
   */
  contact: { numbers: ReadonlyArray<{ channelId: string; value: string; stopped: boolean; usualAt?: string | null }>; lines: readonly RecipientLine[] } | null
}

export type BillTextFace =
  /** `to` is null when the customer has no contact yet: the number is read on the next screen. */
  | { kind: 'text'; to: string | null; words: string; note: string }
  /** No text can go: the sheet's own reason. */
  | { kind: 'hold'; words: string }

export interface BillTextFaceInput {
  read: BillTextFaceRead
  /** "$1,850.00" */
  amountLabel: string
  userId: string
  /** The office team texts a customer; anyone else reads the hold. */
  office: boolean
  nowIso: string
}

/** The text the next screen would open on, or why none can go: the Tell the customer sheet's rules, with a sample link. */
export function billTextFace({ read, amountLabel, userId, office, nowIso }: BillTextFaceInput): BillTextFace {
  const first = firstWord(read.job.customerName)
  const numbers = read.contact?.numbers ?? []
  const choices = numberChoices(
    { channels: numbers.map((n) => ({ id: n.channelId, kind: 'phone' as const, value: n.value, optedOutAt: n.stopped ? 'stopped' : null, usualAt: n.usualAt ?? null })) },
    read.contact?.lines ?? [],
    nowIso,
  )
  const number = numbers.find((n) => n.channelId === choices[0]?.id) ?? null
  // With no contact yet the number is unknown, not missing: only the holds that need no number are judged.
  const hold = tellHold({ office, hasCustomer: Boolean(read.job.customerId), number: read.contact ? (number?.value ?? null) : 'unknown', stopped: number?.stopped ?? false, textsOn: read.textsOn })
  if (hold) return { kind: 'hold', words: holdWords(hold, first) }
  const line = lineFor('billed', read.lines, userId)
  const fills = tellFills({
    customerName: read.job.customerName,
    me: read.me,
    jobName: read.job.jobName,
    jobAddress: read.job.jobAddress,
    bill: { amount: amountLabel, link: SAMPLE_BILL_PAY_LINK },
    portalUrl: read.job.portalUrl ?? null,
  })
  const words = tellWords(line, fills, read.job.lang).text
  return { kind: 'text', to: number ? (phoneContact(number.value)?.display ?? number.value) : null, words, note: line.office ? BILL_FACE_WORDS.officeLine : BILL_FACE_WORDS.appLine }
}
