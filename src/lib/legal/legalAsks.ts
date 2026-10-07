import type { LegalEntryRow } from './legalMatters'
import { recordedByOf } from '../../../supabase/functions/_shared/legalPortalActs'

/**
 * Asks and answers between the office and the law firm (punch list #41, PR 3).
 *
 * Until now the stream ran one way: the firm asked (`question`, via_portal)
 * and the office answered (`answer`, from the desk). Counsel's memo names two
 * moments that need the other direction — *take counsel's sign-off on that
 * job before you accept the check* (an owner paying Click direct while the GC
 * is silent) and a question back about a form. One channel, two flavors:
 *
 *   - an ASK is a `question` entry the office wrote (`via_portal = false`)
 *     with `meta.flavor` = 'question' | 'signoff' and, for a sign-off, the
 *     job it is about; `acknowledged_at` on an ask means the office withdrew it;
 *   - the firm's ANSWER is an `answer` entry through its portal
 *     (`via_portal = true`) with `meta.askId` and, for a sign-off,
 *     `meta.signedOff`; it lands on the office's Needs You like any firm act.
 *
 * Since item 17 of punch list #85 the other direction threads the same way:
 * the office's answer to a firm question carries `meta.askId` too, and
 * `buildLegalConversation` draws every question with its answers under it.
 *
 * Both kinds were already in the table's CHECK (v2.3313) — no migration.
 * Pure: the desk, the portal, the Needs You card and the notice footer read
 * these.
 */

/** `settlement` (#85 item 20) is the firm's: a settled step under the office's floor, which the office signs off. */
export type LegalAskFlavor = 'question' | 'signoff' | 'settlement'

export type LegalAskMeta = { flavor: LegalAskFlavor; jobId: string | null; jobLabel: string; askedBy: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

export function askMetaOf(meta: unknown): LegalAskMeta {
  const m = isRecord(meta) ? meta : {}
  return {
    flavor: m.flavor === 'signoff' ? 'signoff' : m.flavor === 'settlement' ? 'settlement' : 'question',
    jobId: typeof m.jobId === 'string' && m.jobId ? m.jobId : null,
    jobLabel: typeof m.jobLabel === 'string' ? m.jobLabel : '',
    askedBy: typeof m.askedBy === 'string' ? m.askedBy : '',
  }
}

/** The meta an office ask is written with (`legal_add_entry`, kind `question`). */
export function newAskMeta(args: { flavor: LegalAskFlavor; jobId?: string | null; jobLabel?: string; askedBy?: string }): Record<string, unknown> {
  return { flavor: args.flavor, jobId: args.jobId ?? null, jobLabel: args.jobLabel ?? '', askedBy: args.askedBy ?? '' }
}

export function isOfficeAsk(e: Pick<LegalEntryRow, 'kind' | 'via_portal'>): boolean {
  return e.kind === 'question' && !e.via_portal
}
export function isFirmAnswer(e: Pick<LegalEntryRow, 'kind' | 'via_portal'>): boolean {
  return e.kind === 'answer' && Boolean(e.via_portal)
}

export type LegalAnswerMeta = { askId: string | null; signedOff: boolean | null }
export function answerMetaOf(meta: unknown): LegalAnswerMeta {
  const m = isRecord(meta) ? meta : {}
  return { askId: typeof m.askId === 'string' && m.askId ? m.askId : null, signedOff: typeof m.signedOff === 'boolean' ? m.signedOff : null }
}

export type LegalAskState = 'open' | 'answered' | 'withdrawn'

export type LegalAsk = {
  id: string
  matterId: string
  flavor: LegalAskFlavor
  jobId: string | null
  jobLabel: string
  body: string
  askedOn: string
  askedBy: string
  state: LegalAskState
  answer: { id: string; body: string; signedOff: boolean | null; on: string } | null
}

/** Every office ask in the stream with its answer, oldest first. */
export function buildLegalAsks(entries: ReadonlyArray<LegalEntryRow>): LegalAsk[] {
  const answers = entries.filter(isFirmAnswer)
  return entries
    .filter(isOfficeAsk)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((e) => {
      const meta = askMetaOf(e.meta)
      const ans = answers.filter((a) => answerMetaOf(a.meta).askId === e.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
      const state: LegalAskState = ans ? 'answered' : e.acknowledged_at ? 'withdrawn' : 'open'
      return {
        id: e.id,
        matterId: e.matter_id,
        flavor: meta.flavor,
        jobId: meta.jobId,
        jobLabel: meta.jobLabel,
        body: e.body,
        askedOn: e.occurred_on,
        askedBy: meta.askedBy,
        state,
        answer: ans ? { id: ans.id, body: ans.body, signedOff: answerMetaOf(ans.meta).signedOff, on: ans.occurred_on } : null,
      }
    })
}

export function openAsks(entries: ReadonlyArray<LegalEntryRow>): LegalAsk[] {
  return buildLegalAsks(entries).filter((a) => a.state === 'open')
}

/** `Sign off · 273` / `Question` — the ask's short name. */
export function askKindWords(a: Pick<LegalAsk, 'flavor' | 'jobLabel'>): string {
  return a.flavor === 'signoff' ? `Sign off${a.jobLabel ? ` · ${a.jobLabel}` : ''}` : 'Question'
}

/** The state as words for the desk — `waiting on the firm` · `signed off Oct 3` · `not yet · Oct 3` · `answered Oct 3` · `withdrawn`. */
export function askStateWords(a: LegalAsk, formatDay: (ymd: string) => string = (y) => y): { text: string; tone: 'warn' | 'ok' | 'stop' | 'neutral' } {
  if (a.state === 'withdrawn') return { text: 'withdrawn', tone: 'neutral' }
  if (a.state === 'open') return { text: 'waiting on the firm', tone: 'warn' }
  const on = a.answer ? formatDay(a.answer.on) : ''
  if (a.flavor === 'signoff') {
    if (a.answer?.signedOff === true) return { text: `signed off ${on}`, tone: 'ok' }
    if (a.answer?.signedOff === false) return { text: `not yet · ${on}`, tone: 'stop' }
  }
  return { text: `answered ${on}`, tone: 'ok' }
}

/** What the firm's answer row says in a table — `signed off` · `not yet` · `answer`. */
export function legalEntryKindWords(e: Pick<LegalEntryRow, 'kind' | 'via_portal' | 'meta'>): string {
  if (isOfficeAsk(e)) {
    const m = askMetaOf(e.meta)
    return m.flavor === 'signoff' ? `ask · sign off${m.jobLabel ? ` · ${m.jobLabel}` : ''}` : 'ask · question'
  }
  if (isFirmAnswer(e)) {
    const m = answerMetaOf(e.meta)
    return m.signedOff === true ? 'answer · signed off' : m.signedOff === false ? 'answer · not yet' : 'answer'
  }
  if (e.kind === 'question' && e.via_portal && askMetaOf(e.meta).flavor === 'settlement') return 'settlement ask'
  if (stepProposalOf(e)) return 'step · asks to move the stage back'
  return e.kind.replace('_', ' ')
}

/**
 * A firm step that would have moved the stage backward (#85 item 16): recorded,
 * stage unchanged, waiting on the office. `submit-legal-portal` writes
 * `meta.proposed = true` with the stage it asked for (`meta.stage`) and the one
 * it found (`meta.from`). Null on any other entry.
 */
export function stepProposalOf(e: Pick<LegalEntryRow, 'kind' | 'meta'>): { stage: string; from: string } | null {
  if (e.kind !== 'step' || !isRecord(e.meta) || e.meta.proposed !== true) return null
  return { stage: typeof e.meta.stage === 'string' ? e.meta.stage : '', from: typeof e.meta.from === 'string' ? e.meta.from : '' }
}

export type LegalSignoffState = { state: 'none' | 'asked' | 'signed_off' | 'declined'; on: string; askId: string | null }

/** The newest sign-off ask about one job — what the notice footer reads. */
export function signoffStateForJob(entries: ReadonlyArray<LegalEntryRow>, jobId: string): LegalSignoffState {
  const asks = buildLegalAsks(entries).filter((a) => a.flavor === 'signoff' && a.jobId === jobId && a.state !== 'withdrawn')
  const last = asks[asks.length - 1]
  if (!last) return { state: 'none', on: '', askId: null }
  if (last.state === 'open') return { state: 'asked', on: last.askedOn, askId: last.id }
  if (last.answer?.signedOff === true) return { state: 'signed_off', on: last.answer.on, askId: last.id }
  if (last.answer?.signedOff === false) return { state: 'declined', on: last.answer.on, askId: last.id }
  return { state: 'asked', on: last.askedOn, askId: last.id }
}

/** The footer's words for a sign-off state; '' when nothing was asked. */
export function signoffWords(s: LegalSignoffState, formatDay: (ymd: string) => string = (y) => y): string {
  if (s.state === 'asked') return `asked counsel to sign off ${formatDay(s.on)} · waiting`
  if (s.state === 'signed_off') return `counsel signed off ${formatDay(s.on)} · take the owner's payment`
  if (s.state === 'declined') return `counsel said not yet ${formatDay(s.on)}`
  return ''
}

/** The default text of a sign-off ask from a sent notice — the memo's moment, in the office's words. */
export function defaultSignoffAsk(args: { gcName: string; amount: string }): string {
  return `The owner wants to pay Click direct against a release${args.amount ? ` — ${args.amount}` : ''}; ${args.gcName || 'the GC'} has not answered and has given no written okay. May we take the check?`
}

// ---------------------------------------------------------------------------
// The conversation (punch list #85, item 17): every question on the matter with
// its answer under it, whichever side asked.
// ---------------------------------------------------------------------------

/** True for the entries the conversation owns — the steps and money tables leave these out. */
export function isConversationEntry(e: Pick<LegalEntryRow, 'kind'>): boolean {
  return e.kind === 'question' || e.kind === 'answer'
}

/** The office's answer to a firm question, written from the desk (`answer`, via_portal = false). */
function isOfficeAnswer(e: Pick<LegalEntryRow, 'kind' | 'via_portal'>): boolean {
  return e.kind === 'answer' && !e.via_portal
}

export type LegalThreadState = 'open' | 'answered' | 'seen' | 'withdrawn'

export type LegalThread = {
  question: LegalEntryRow
  /** Who asked: the office (an ask, #41 PR 3) or the firm (a question through its portal). */
  askedBy: 'office' | 'firm'
  /** The office person named on an ask; '' for the firm's questions. */
  askerName: string
  flavor: LegalAskFlavor
  jobLabel: string
  /** Oldest first; usually one. */
  answers: LegalEntryRow[]
  state: LegalThreadState
  /**
   * An answer with no question to sit under (no `askId` and no earlier unanswered firm question, or an
   * `askId` that is not on the matter): its own row, `question` is the answer itself, never dropped.
   */
  orphan?: boolean
}

/**
 * Every question with its answers, oldest question first. The office's answer
 * carries `meta.askId` since item 17; an older one has none and threads under
 * the newest firm question before it that has no answer yet — the desk wrote
 * them that way (answer, then acknowledge that question). A firm question the
 * office acknowledged without answering reads `seen`; an office ask it
 * acknowledged reads `withdrawn`.
 */
export function buildLegalConversation(entries: ReadonlyArray<LegalEntryRow>): LegalThread[] {
  const byTime = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const questions = byTime.filter((e) => e.kind === 'question')
  const answersFor = new Map<string, LegalEntryRow[]>(questions.map((q) => [q.id, []]))
  const orphans: LegalEntryRow[] = []
  for (const a of byTime.filter((e) => e.kind === 'answer')) {
    const linked = answerMetaOf(a.meta).askId
    if (linked && answersFor.has(linked)) {
      answersFor.get(linked)!.push(a)
      continue
    }
    const target = !linked && isOfficeAnswer(a) ? [...questions].reverse().find((q) => q.via_portal && q.created_at <= a.created_at && (answersFor.get(q.id)?.length ?? 0) === 0) : undefined
    if (target) answersFor.get(target.id)!.push(a)
    else orphans.push(a)
  }
  const orphanThreads = orphans.map((a): LegalThread => ({ question: a, askedBy: a.via_portal ? 'firm' : 'office', askerName: '', flavor: 'question', jobLabel: '', answers: [], state: 'answered', orphan: true }))
  const threads = questions.map((q): LegalThread => {
    const answers = answersFor.get(q.id) ?? []
    if (q.via_portal) {
      return { question: q, askedBy: 'firm', askerName: '', flavor: askMetaOf(q.meta).flavor === 'settlement' ? 'settlement' : 'question', jobLabel: '', answers, state: answers.length ? 'answered' : q.acknowledged_at ? 'seen' : 'open' }
    }
    const meta = askMetaOf(q.meta)
    return { question: q, askedBy: 'office', askerName: meta.askedBy, flavor: meta.flavor, jobLabel: meta.jobLabel, answers, state: answers.length ? 'answered' : q.acknowledged_at ? 'withdrawn' : 'open' }
  })
  return [...threads, ...orphanThreads].sort((x, y) => x.question.created_at.localeCompare(y.question.created_at))
}

export type LegalConversationRow = { entry: LegalEntryRow; thread: LegalThread; isAnswer: boolean }

/** The conversation flattened for a table: each question, then its answers under it. */
export function conversationRows(entries: ReadonlyArray<LegalEntryRow>): LegalConversationRow[] {
  return buildLegalConversation(entries).flatMap((t) => (t.orphan ? [{ entry: t.question, thread: t, isAnswer: true }] : [{ entry: t.question, thread: t, isAnswer: false }, ...t.answers.map((a) => ({ entry: a, thread: t, isAnswer: true }))]))
}

/** Who said it, from the reader's side — the firm reads *You asked*, the office reads *The firm asked*. */
export function conversationWho(row: LegalConversationRow, reader: 'firm' | 'office'): string {
  const fromFirm = row.entry.via_portal
  // #85 item 18: a firm act names the person the firm picked.
  const by = fromFirm ? recordedByOf(row.entry.meta) : null
  if (row.isAnswer) return fromFirm ? (reader === 'firm' ? (by?.name ?? 'You') : by ? `${by.name} · firm` : 'The firm') : 'The office'
  const settle = row.thread.flavor === 'settlement' ? ` to settle at ${settlementAmountWords(row.entry)}` : ''
  if (fromFirm) return `${reader === 'firm' ? (by ? `${by.name} asked` : 'You asked') : by ? `${by.name} at the firm asked` : 'The firm asked'}${settle}`
  const asker = row.thread.askerName || (reader === 'firm' ? 'The office' : 'We')
  const job = row.thread.flavor === 'signoff' && row.thread.jobLabel ? ` · ${row.thread.jobLabel}` : ''
  return `${asker} ${row.thread.flavor === 'signoff' ? 'asked for a sign-off' : 'asked'}${job}`
}

/**
 * The row's state from the reader's side. On a question: where the thread
 * stands. On the firm's own answer: whether the office has seen it. Null on
 * the office's answer, which needs nothing from anyone.
 */
export function conversationStateWords(row: LegalConversationRow, reader: 'firm' | 'office', formatDay: (ymd: string) => string = (y) => y): { text: string; tone: 'warn' | 'ok' | 'stop' | 'neutral' } | null {
  const t = row.thread
  if (row.isAnswer) {
    if (!row.entry.via_portal) return null
    return row.entry.acknowledged_at ? { text: 'seen', tone: 'ok' } : { text: reader === 'firm' ? 'waiting on the office' : 'waiting on you', tone: 'warn' }
  }
  const last = t.answers[t.answers.length - 1]
  const on = last ? formatDay(last.occurred_on) : ''
  if (t.askedBy === 'firm') {
    if (t.flavor === 'settlement' && t.state === 'answered') {
      const yes = answerMetaOf(last?.meta).signedOff
      if (yes === true) return { text: `signed off ${on}`, tone: 'ok' }
      if (yes === false) return { text: `not yet · ${on}`, tone: 'stop' }
    }
    if (t.state === 'answered') return { text: `answered ${on}`, tone: 'ok' }
    if (t.state === 'seen') return { text: 'seen', tone: 'ok' }
    return { text: reader === 'firm' ? 'waiting on the office' : 'waiting on you', tone: 'warn' }
  }
  if (t.state === 'withdrawn') return { text: 'withdrawn', tone: 'neutral' }
  if (t.state === 'open') return { text: reader === 'firm' ? 'asks you' : 'waiting on the firm', tone: 'warn' }
  const signed = answerMetaOf(last?.meta).signedOff
  if (t.flavor === 'signoff' && signed === true) return { text: `signed off ${on}`, tone: 'ok' }
  if (t.flavor === 'signoff' && signed === false) return { text: `not yet · ${on}`, tone: 'stop' }
  return { text: reader === 'firm' ? `you answered ${on}` : `answered ${on}`, tone: 'ok' }
}

/** The meta the office's answer to a firm question is written with (item 17) — what threads it. */
export function officeAnswerMeta(questionId: string): Record<string, unknown> {
  return { askId: questionId }
}

/**
 * Who recorded an entry, from the reader's side (#85 item 18). A firm act names
 * the person the firm picked (`meta.recordedBy`), else *your firm* / *the firm*;
 * an office entry is *the office* to the firm and its author to the office.
 */
export function entryRecordedByWords(e: Pick<LegalEntryRow, 'via_portal' | 'meta' | 'created_by'>, reader: 'firm' | 'office', userNameOf: (id: string | null) => string | null = () => null): string {
  if (e.via_portal) {
    const by = recordedByOf(e.meta)
    if (by) return reader === 'firm' ? by.name : `${by.name} · firm`
    return reader === 'firm' ? 'your firm' : 'the firm'
  }
  return reader === 'firm' ? 'the office' : (userNameOf(e.created_by) ?? 'the office')
}

/** The proposed amount on a firm's settlement ask (`meta.proposedAmount`, else the entry's amount), as dollars. */
export function settlementAmountWords(e: Pick<LegalEntryRow, 'amount' | 'meta'>): string {
  const m = isRecord(e.meta) ? e.meta : {}
  const raw = typeof m.proposedAmount === 'number' ? m.proposedAmount : Number(e.amount ?? 0)
  return `$${(Number.isFinite(raw) ? raw : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
