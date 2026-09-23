import type { LegalEntryRow } from './legalMatters'

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
 * Both kinds were already in the table's CHECK (v2.3313) — no migration.
 * Pure: the desk, the portal, the Needs You card and the notice footer read
 * these.
 */

export type LegalAskFlavor = 'question' | 'signoff'

export type LegalAskMeta = { flavor: LegalAskFlavor; jobId: string | null; jobLabel: string; askedBy: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

export function askMetaOf(meta: unknown): LegalAskMeta {
  const m = isRecord(meta) ? meta : {}
  return {
    flavor: m.flavor === 'signoff' ? 'signoff' : 'question',
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
  return e.kind.replace('_', ' ')
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
