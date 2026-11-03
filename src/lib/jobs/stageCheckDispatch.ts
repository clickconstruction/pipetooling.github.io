/**
 * Send a stage check to Dispatch (punch list #245): the rules behind the press on a stage checklist row. A crew member
 * hits a check they cannot answer, picks why, says what Dispatch should know, and the row goes to Dispatch as one more
 * structured flavour of a dispatch request, `pending_action = 'stage_check'`, with the job, the stage and the check on it,
 * so the inbox, the push, the thread, the priority card and *Questions on this job* carry it for free. The title is built
 * from the context so the inbox row reads right without a window: *Trim Set · "Is the pan drain run to the hub?" · need a
 * part: the caps are not on the truck · JP1088 ZZ TEST Riders Walk*. The crew's words also go as the first note on the
 * thread (PR 2 draws the thread; PR 1 writes the title). One open request per check per stage; a second send while one is
 * open reads *Already with Dispatch*. *Can't do it* marks the request high, since a stopped crew is what *Customer waiting*
 * was built for. Pure; the io is `stageCheckDispatchIo.ts`.
 */
import { describeWait, type RequestPriority } from '../requestPriority'
import { PICK_WORDS, type StageChecklistAnswer, type StageChecklistQuestion } from './stageChecklist'

/** The `pending_action` of a check sent from the sheet. */
export const STAGE_CHECK_ACTION = 'stage_check'

/** `dispatch_requests.title` is checked at 2000 characters. */
export const STAGE_CHECK_TITLE_MAX = 2000
/** The longest the crew's words run. */
export const STAGE_CHECK_WORDS_MAX = 500
/** The longest piece of the question that goes into the title, cut on a word. */
export const STAGE_CHECK_QUESTION_MAX = 160

/** Why the crew sends a check: the five chips (call 1 of the card, shipped as recommended). */
export type StageCheckReason = 'cant_do' | 'not_on_job' | 'need_part' | 'need_decision' | 'other'

export interface StageCheckReasonDef {
  key: StageCheckReason
  /** The chip. */
  label: string
  /** The tail of the title and the row's chip: lower case, after the question. */
  tail: string
  /** True when the words box must be filled. */
  wordsRequired: boolean
  /** The request's priority: a stopped crew leads the inbox. */
  priority: RequestPriority
}

const OTHER_REASON: StageCheckReasonDef = { key: 'other', label: 'Something else', tail: 'something else', wordsRequired: true, priority: 'normal' }

export const STAGE_CHECK_REASONS: readonly StageCheckReasonDef[] = [
  { key: 'cant_do', label: "Can't do it", tail: "can't do it", wordsRequired: false, priority: 'high' },
  { key: 'not_on_job', label: 'Not on this job', tail: 'not on this job', wordsRequired: false, priority: 'normal' },
  { key: 'need_part', label: 'Need a part', tail: 'need a part', wordsRequired: false, priority: 'normal' },
  { key: 'need_decision', label: 'Need a decision', tail: 'need a decision', wordsRequired: false, priority: 'normal' },
  OTHER_REASON,
]

export const isStageCheckReason = (v: unknown): v is StageCheckReason => STAGE_CHECK_REASONS.some((r) => r.key === v)

export function stageCheckReason(key: StageCheckReason): StageCheckReasonDef {
  return STAGE_CHECK_REASONS.find((r) => r.key === key) ?? OTHER_REASON
}

/** The reason a draft cannot go, or null. The chip is required; the words only under *Something else*. */
export function stageCheckProblem(reason: StageCheckReason | null, words: string): string | null {
  if (!reason) return 'Pick why you are sending it.'
  const trimmed = words.trim()
  if (stageCheckReason(reason).wordsRequired && !trimmed) return 'Say what Dispatch should know.'
  if (trimmed.length > STAGE_CHECK_WORDS_MAX) return `Keep it under ${STAGE_CHECK_WORDS_MAX} characters.`
  return null
}

/** The request's priority from its reason. */
export function stageCheckPriority(reason: StageCheckReason): RequestPriority {
  return stageCheckReason(reason).priority
}

// ── The job on the request ───────────────────────────────────────────────────

/** What the sheet knows of the job, as the ledger names it; any piece may be blank for a role that reads less. */
export interface StageCheckJob {
  id: string
  hcpNumber?: string | null
  name?: string | null
  address?: string | null
}

/** *JP1088 ZZ TEST Riders Walk*, *JP1088*, *ZZ TEST Riders Walk*, or '' when the read gave nothing. */
export function stageCheckJobLabel(job: Pick<StageCheckJob, 'hcpNumber' | 'name'>): string {
  const n = (job.hcpNumber ?? '').trim()
  const name = (job.name ?? '').trim()
  return [n ? `JP${n.replace(/^JP/i, '')}` : '', name].filter(Boolean).join(' ')
}

/** The inbox's reference line: *JP1088 · ZZ TEST Riders Walk · 12925 FM 20, Kingsbury*, the pieces the read gave; the title names the stage. */
export function stageCheckReferenceSummary(job: StageCheckJob): string {
  const n = (job.hcpNumber ?? '').trim()
  return [n ? `JP${n.replace(/^JP/i, '')}` : '', (job.name ?? '').trim(), (job.address ?? '').trim()].filter(Boolean).join(' · ')
}

// ── The title ────────────────────────────────────────────────────────────────

function cutOnWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 0 ? cut.slice(0, space) : text.slice(0, max)).replace(/[.\s,]+$/, '')}…`
}

export interface StageCheckTitleInput {
  stageName: string
  question: string
  reason: StageCheckReason
  words: string
  job: Pick<StageCheckJob, 'hcpNumber' | 'name'>
}

/**
 * *Trim Set · "Is the pan drain run to the hub?" · need a part: the caps are not on the truck · JP1088 ZZ TEST Riders
 * Walk*. The words follow the reason after a colon when there are any; the job closes the line when the read gave it.
 * Held under the column's 2000 characters by cutting the words, never the question or the job.
 */
export function stageCheckTitle(input: StageCheckTitleInput): string {
  const stage = input.stageName.trim() || 'Stage'
  const question = cutOnWord(input.question.trim().replace(/\s+/g, ' '), STAGE_CHECK_QUESTION_MAX)
  const reason = stageCheckReason(input.reason).tail
  const words = input.words.trim().replace(/\s+/g, ' ')
  const job = stageCheckJobLabel(input.job)
  const head = `${stage} · “${question}” · ${reason}`
  const tail = job ? ` · ${job}` : ''
  if (!words) return `${head}${tail}`
  const room = STAGE_CHECK_TITLE_MAX - head.length - tail.length - 2
  return `${head}: ${room < words.length ? cutOnWord(words, Math.max(0, room - 1)) : words}${tail}`
}

// ── The row ──────────────────────────────────────────────────────────────────

/** The `dispatch_requests` row the send inserts. The two id columns are migration `20261102113000`'s. A type, not an interface, so it reads as a lane's row. */
export type StageCheckRow = {
  from_user_id: string
  title: string
  links: string[]
  job_ledger_id: string
  bid_id: null
  development_id: null
  reference_summary: string | null
  pending_action: typeof STAGE_CHECK_ACTION
  /** The same three facts as the inbox reads them: its select has carried `pending_payload` since v2.1615, and the two id columns only after the push. */
  pending_payload: { stage_check: StageCheckPayload }
  priority: RequestPriority
  fixture_id: string
  checklist_question_id: string
}

/** What rides in `pending_payload.stage_check`: the stage, the check and the reason, so the inbox row's doors need no new column. */
export interface StageCheckPayload {
  fixture_id: string
  question_id: string
  reason: StageCheckReason
  stage_name: string
}

/** The payload off an inbox row, or null on any other request. */
export function stageCheckPayloadFrom(payload: unknown): StageCheckPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const sc = (payload as { stage_check?: unknown }).stage_check
  if (!sc || typeof sc !== 'object') return null
  const { fixture_id, question_id, reason, stage_name } = sc as Record<string, unknown>
  if (typeof fixture_id !== 'string' || typeof question_id !== 'string' || !fixture_id || !question_id) return null
  return { fixture_id, question_id, reason: isStageCheckReason(reason) ? reason : 'other', stage_name: typeof stage_name === 'string' ? stage_name : '' }
}

export interface StageCheckDraft {
  fromUserId: string
  job: StageCheckJob
  fixtureId: string
  stageName: string
  question: Pick<StageChecklistQuestion, 'id' | 'words'>
  reason: StageCheckReason
  words: string
}

export function stageCheckRow(draft: StageCheckDraft): StageCheckRow {
  return {
    from_user_id: draft.fromUserId,
    title: stageCheckTitle({ stageName: draft.stageName, question: draft.question.words, reason: draft.reason, words: draft.words, job: draft.job }),
    links: [],
    job_ledger_id: draft.job.id,
    bid_id: null,
    development_id: null,
    reference_summary: stageCheckReferenceSummary(draft.job) || null,
    pending_action: STAGE_CHECK_ACTION,
    pending_payload: { stage_check: { fixture_id: draft.fixtureId, question_id: draft.question.id, reason: draft.reason, stage_name: draft.stageName.trim() } },
    priority: stageCheckPriority(draft.reason),
    fixture_id: draft.fixtureId,
    checklist_question_id: draft.question.id,
  }
}

// ── What is with Dispatch ────────────────────────────────────────────────────

/** An open stage-check request as the sheet reads it back. */
export interface OpenStageCheck {
  id: string
  fixtureId: string
  questionId: string
  title: string
  createdAt: string
  priority: RequestPriority | string | null
}

/** The open request on this stage's check, or null. */
export function openStageCheckFor(open: readonly OpenStageCheck[], fixtureId: string, questionId: string): OpenStageCheck | null {
  return open.find((r) => r.fixtureId === fixtureId && r.questionId === questionId) ?? null
}

/** The reason's tail read back off a built title, or '' when the title is not one the sheet built. */
export function reasonTailFromTitle(title: string): string {
  const after = title.split('” · ')[1]
  if (!after) return ''
  const tail = after.split(/[:·]/)[0]?.trim() ?? ''
  return STAGE_CHECK_REASONS.some((r) => r.tail === tail) ? tail : ''
}

/** *now*, *2 min*, *3 hr*, *2 days*: how long the check has been with Dispatch. */
export function withDispatchAgeWords(createdAtIso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(createdAtIso)
  if (!Number.isFinite(ms) || ms < 60_000) return 'now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr`
  const days = Math.floor(hr / 24)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** The row's chip: *With Dispatch · 12 min · need a part*. */
export function withDispatchWords(request: Pick<OpenStageCheck, 'title' | 'createdAt'>, nowMs: number): string {
  const tail = reasonTailFromTitle(request.title)
  return ['With Dispatch', withDispatchAgeWords(request.createdAt, nowMs), tail].filter(Boolean).join(' · ')
}

/**
 * The red line over a stage check that leads the Dispatch inbox (v2.6462): the request's own reason and its wait,
 * *Can't do it · waiting 4 min*, red-700 once the wait passes the Customer waiting threshold. A waiting stage check
 * draws as its own row with this line, never as the portal's Customer waiting card, whose name, number and Call are
 * a customer's. The reason is read off the payload, so a check Dispatch raised reads *Need a part · waiting 1 h*.
 */
export function stageCheckWaiting(reason: unknown, createdAtIso: string | null | undefined, nowMs: number): { words: string; red: boolean } {
  const wait = describeWait(createdAtIso, nowMs)
  const waitWords = wait ? wait.label : 'waiting'
  const label = isStageCheckReason(reason) ? stageCheckReason(reason).label : ''
  return { words: label ? `${label} · ${waitWords}` : `${waitWords.charAt(0).toUpperCase()}${waitWords.slice(1)}`, red: wait?.red ?? false }
}

// ── The sheet's words ────────────────────────────────────────────────────────

export const STAGE_CHECK_WORDS = {
  /** The quiet press on the open row. */
  press: 'Send to Dispatch',
  title: 'Send this check to Dispatch',
  why: 'Why',
  whyHint: 'pick one',
  wordsLabel: 'What should Dispatch know?',
  wordsPlaceholder: 'The part, the drawing, the question. Dispatch reads this first.',
  foot: 'Dispatch gets a push. The answer comes back on this row.',
  footHigh: "Can't do it marks a stopped crew, so it leads the inbox.",
  notNow: 'Not now',
  confirm: 'Send to Dispatch',
  sending: 'Sending…',
  already: 'Already with Dispatch',
  /** The inbox row's tag. */
  tag: 'Stage check',
  openJob: 'Open the job',
  openCheck: 'Open the check',
  /** Beside Raise priority in the thread, on a stage check that leads the inbox (v2.6462). */
  lower: 'Lower priority',
} as const

/** The toast after a send. */
export function stageCheckSentWords(reason: StageCheckReason): string {
  const high = stageCheckPriority(reason) === 'high'
  return high ? 'Sent to Dispatch as a stopped crew. It leads their inbox, and the answer comes back on this row.' : 'Sent to Dispatch. The answer comes back on this row.'
}

/** What a second send on a check already with Dispatch says. */
export function alreadyWithDispatchWords(request: Pick<OpenStageCheck, 'title' | 'createdAt'>, nowMs: number): string {
  return `${STAGE_CHECK_WORDS.already} since ${withDispatchAgeWords(request.createdAt, nowMs) === 'now' ? 'a moment ago' : `${withDispatchAgeWords(request.createdAt, nowMs)} ago`}. Dispatch has it.`
}

/** The context card's second line: *asks for a photo · the company's question · Yes, Luis Ortega · Nov 2 · 9:14 am*. */
export function contextMetaWords(q: Pick<StageChecklistQuestion, 'asksPhoto' | 'fixtureId' | 'addedBy'>, answer: Pick<StageChecklistAnswer, 'pick'> | null | undefined, stamp: string): string {
  const who = q.fixtureId ? (q.addedBy?.trim() ? `added by ${q.addedBy.trim()}` : 'added for this job') : "the company's question"
  const pick = answer?.pick ? `${PICK_WORDS[answer.pick]}${stamp ? `, ${stamp}` : ''}` : 'not answered yet'
  return [q.asksPhoto ? 'asks for a photo' : '', who, pick].filter(Boolean).join(' · ')
}

/** The reason a send is refused by the database, in the crew's words. 23505 is the dedupe index: the check is already with Dispatch. */
export function stageCheckRefusalWords(e: unknown, fallback: string): string {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : ''
  if (code === '23505') return `${STAGE_CHECK_WORDS.already}. Dispatch has it.`
  return fallback
}
