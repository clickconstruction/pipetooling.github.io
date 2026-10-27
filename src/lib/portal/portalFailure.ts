/**
 * The public pages' voice when something fails (punch list #184, sweep D, PR 3 part 2, v2.5965): a customer, a
 * GC, a sub or an owner reads the class of a failure, or the sentence our own function wrote for them. Never any
 * other server text.
 *
 * Three classes, decided by structure and never by message text (v2.2843):
 *  - `network`: the fetch itself rejected (`errorKindOf` says `network`). Nothing reached the office, so the page
 *    says *No connection* and offers Try again.
 *  - `gone`: a load answered 404 or 410 with no code the page words itself. The link is dead, so the page says so
 *    and points at the office.
 *  - `refused`: anything else. The server answered no, or the page's own code threw. The page says *We couldn't
 *    record that.* for a send or *We couldn't open this page.* for a load. Then *Please call the office.* where the
 *    page has the number and shows Call the office, or *Please try again later.* where it has none. A load also
 *    offers Try again, since a refused read may be passing.
 *
 * The known sentences: our functions answer many refusals with a sentence written for the person reading (*This
 * offer has expired — call the office if you still want it.*, *That change order is already answered.*). Each is a
 * `said*` key of `gc/portalI18n.ts`, its English the function's words verbatim. An answer whose `error` is one of
 * them, exactly after trim, reads that sentence in the page's language as its title. *Please call the office.*
 * follows where the sentence leaves the person no step of their own and the page has the number. The status still
 * decides the class, so a dead link's own sentence keeps the gone link's presses. Any other text, *Missing token*,
 * *Bad request* or a database message, never reaches the page.
 *
 * A page that keys a structured `code` of its own (the bid room's `closed`, the contract's `paper_changed`) keeps
 * those words; this decides the rest. A page with no language of its own passes nothing and reads English. Pure.
 */
import { errorKindOf } from '../../utils/errorHandling'
import { PORTAL_KEYS, portalString, pt, type PortalKey, type PortalLang } from '../gc/portalI18n'

/** What the page was doing: opening (a load) or sending (a write). */
export type PortalAct = 'open' | 'send'

/** The class of a failure a person on a public page reads. */
export type PortalFailureKind = 'network' | 'gone' | 'refused'

/**
 * What a page keeps of a failure, so its words can follow a language picked after it: the class alone, or the class
 * with the function's own sentence when it was one we know.
 */
export type PortalFailureCause = PortalFailureKind | { kind: PortalFailureKind; known: PortalKey }

export type PortalFailure = {
  kind: PortalFailureKind
  /** What happened, short enough for a heading: *No connection*, or the function's own sentence. */
  title: string
  /** What to do next, one sentence, or empty when the function's sentence already says it. */
  detail: string
  /** Both as one line, for a place with no heading. */
  message: string
  /** Whether Try again can help: a lost signal, or a refused load. Never a gone link, never a refused send. */
  tryAgain: boolean
  /** The office's number when a call can help, a refusal or a gone link on a page that has it: the note offers Call the office. */
  phone: string | null
  /** The function's own sentence, when the answer carried one we know. */
  known: PortalKey | null
}

export type PortalFailureOptions = {
  /** The office's number, when the page has it. A refusal then says *Please call the office.* and offers the call. */
  phone?: string | null
}

/** The known sentences that leave the person no step of their own: a page with the office's number adds *Please call the office.* */
const CALL_US_AFTER: ReadonlySet<PortalKey> = new Set<PortalKey>([
  'saidContractNotYours', 'saidJobNotYours', 'saidChangeOrderNotYours', 'saidChangeOrderAnswered',
  'saidWorkAccepted', 'saidBillEveryLine', 'saidJobNotAcceptable', 'saidBillNotYours', 'saidLinkOff',
  'saidRequestNotHere', 'saidRecordsNotOffered', 'saidRecordsSent', 'saidProposalWithdrawn', 'saidChangeOrderOnFile',
  'saidProposalOnFile', 'saidEstimateNotWaiting', 'saidOptionGone', 'saidEstimateTaken', 'saidGcNotOnLink',
  'saidAgreementWithdrawn', 'saidAgreementNotOut', 'saidNoSecondSigner', 'saidWorkOrderNotOpen',
  'saidWorkOrderClosed', 'saidLinkIncomplete', 'saidReviewClosed', 'saidRevisionNotHere', 'saidRowsNotHere',
  'saidRequestClosed',
])

/** Every known sentence: the `said*` keys of `gc/portalI18n.ts`. */
export const PORTAL_KNOWN_REFUSALS: readonly PortalKey[] = PORTAL_KEYS.filter((k) => k.startsWith('said'))

const KNOWN_BY_TEXT: ReadonlyMap<string, PortalKey> = new Map(PORTAL_KNOWN_REFUSALS.map((k) => [portalString(k).en.trim(), k]))

/**
 * The key of a sentence one of our functions wrote for the person reading, by an exact match after trim. Anything
 * else, a near match, a technical word or a value that is not a string, is null.
 */
export function knownPortalRefusal(text: unknown): PortalKey | null {
  return typeof text === 'string' ? (KNOWN_BY_TEXT.get(text.trim()) ?? null) : null
}

/** A thrown value's class: the network when `errorKindOf` says so, any other throw a refusal. Never `gone`. */
export function portalFailureKind(error: unknown): PortalFailureKind {
  return errorKindOf(error) === 'network' ? 'network' : 'refused'
}

/** The class of a kept cause. */
export function portalCauseKind(cause: PortalFailureCause): PortalFailureKind {
  return typeof cause === 'string' ? cause : cause.kind
}

/**
 * A server answer that said no (`!res.ok`, or `ok: false` in the body), as a page keeps it. The status decides the
 * class: a load answered 404 or 410 is a gone link, anything else a refusal. A known sentence in the body's `error`
 * rides along; no other text does.
 */
export function portalFailureCause(status: number, body: unknown, act: PortalAct): PortalFailureCause {
  const kind: PortalFailureKind = act === 'open' && (status === 404 || status === 410) ? 'gone' : 'refused'
  const known = knownPortalRefusal(body != null && typeof body === 'object' ? (body as { error?: unknown }).error : null)
  return known ? { kind, known } : kind
}

/** The words for a kept cause, an act and a language. */
export function portalFailure(cause: PortalFailureCause, act: PortalAct, lang: PortalLang = 'en', opts: PortalFailureOptions = {}): PortalFailure {
  const kind = portalCauseKind(cause)
  const known = typeof cause === 'string' ? null : cause.known
  const number = (opts.phone ?? '').trim()
  const phone = kind !== 'network' && number !== '' ? number : null
  const tryAgain = kind === 'network' || (kind === 'refused' && act === 'open')
  if (known) {
    const title = pt(lang, known)
    const detail = phone && CALL_US_AFTER.has(known) ? pt(lang, 'failCallUs') : ''
    const message = detail ? `${title}${/[.!?]$/.test(title) ? '' : '.'} ${detail}` : title
    return { kind, title, detail, message, tryAgain, phone, known }
  }
  const words =
    kind === 'network'
      ? { title: pt(lang, 'failNoSignal'), detail: pt(lang, act === 'send' ? 'failNoSignalSend' : 'failNoSignalOpen') }
      : kind === 'gone'
        ? { title: pt(lang, 'failLinkGone'), detail: pt(lang, 'failLinkGoneNext') }
        : { title: pt(lang, act === 'send' ? 'failRefusedSend' : 'failRefusedOpen'), detail: pt(lang, phone ? 'failCallUs' : 'failTryLater') }
  return { kind, ...words, message: `${words.title}. ${words.detail}`, tryAgain, phone, known: null }
}

/** A thrown value on a public page: the fetch rejected, or the page's own code threw. Never its message. */
export function portalFailureFromError(error: unknown, act: PortalAct, lang?: PortalLang, opts?: PortalFailureOptions): PortalFailure {
  return portalFailure(portalFailureKind(error), act, lang, opts)
}

/** An answer that said no, read by its status alone: a load answered 404 or 410 is a gone link, anything else a refusal. */
export function portalFailureFromStatus(status: number, act: PortalAct, lang?: PortalLang, opts?: PortalFailureOptions): PortalFailure {
  return portalFailure(portalFailureCause(status, null, act), act, lang, opts)
}

/**
 * An answer that said no, with its body: the function's own sentence when its `error` is one we know, in the page's
 * language; otherwise exactly the words of its status (`portalFailureFromStatus`).
 */
export function portalFailureFromAnswer(status: number, body: unknown, act: PortalAct, lang?: PortalLang, opts?: PortalFailureOptions): PortalFailure {
  return portalFailure(portalFailureCause(status, body, act), act, lang, opts)
}
