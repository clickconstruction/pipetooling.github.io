/**
 * The owner memo (v2.3232): a robot question written before the one-decision
 * rule (v2.3210) — several decisions in one ask, no tap choices — is not
 * something an estimator can answer with a tap, and nothing on the server
 * re-asks it in pieces. This module turns such an ask into an editable draft of
 * one-decision questions the owner posts from the Console: the original's
 * numbered parts become the decisions, an "Also confirm" clause becomes its own,
 * an "either A or B" question becomes two taps, and everything else defaults to
 * Yes / No for the person to fix before posting. The v2.3210 shape checker
 * decides what may post.
 *
 * Pure module — no React, no Supabase.
 */
import { checkEstimatorQuestionShape, TWIN_QUESTION_CHOICE_MAX_CHARS, TWIN_QUESTION_MAX_CHARS } from '../../../supabase/functions/_shared/twinQuestionShape'

export interface LegacyDecisionDraft {
  /** The robot's own label for the part, when it wrote one in caps before a dash ('SMALL-TI RESIDUAL'). */
  heading: string | null
  question: string
  choices: string[]
  recommended: string | null
  /** Standing-rulings key, from the heading (or the question's first words). */
  topic: string
}

export interface LegacyAskSplit {
  /** Whatever the robot wrote before its first numbered decision — context for the memo, not a question. */
  preamble: string | null
  decisions: LegacyDecisionDraft[]
}

const MARKER = /\(\s*([1-9])\s*\)\s*|(?:^|\s)([1-9])\)\s+/g
const ALSO = /\balso confirm:?\s*/i

/** 'SMALL-TI RESIDUAL' → 'Small-ti residual' — a label, lower-cased past the first letter. */
function humanizeHeading(raw: string): string {
  const lower = raw.trim().replace(/\s+/g, ' ').toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function topicSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

/** 'either a footage residual (…) or ~30% higher per-fixture all-ins?' → two labels; else Yes / No. */
export function defaultChoices(question: string): string[] {
  const m = question.match(/\beither\s+(.+?)\s+\bor\s+(.+?)\s*\?/i)
  if (m && m[1] && m[2]) {
    const strip = (s: string) => s.replace(/\([^)]*\)/g, '').replace(/^(a|an|the)\s+/i, '').replace(/\s+/g, ' ').trim()
    const a = clip(strip(m[1]), TWIN_QUESTION_CHOICE_MAX_CHARS)
    const b = clip(strip(m[2]), TWIN_QUESTION_CHOICE_MAX_CHARS)
    if (a && b && a.toLowerCase() !== b.toLowerCase()) return [a, b]
  }
  return ['Yes', 'No']
}

function draftFromPart(raw: string): LegacyDecisionDraft | null {
  let text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  let heading: string | null = null
  // 'SMALL-TI RESIDUAL — all four fresh runs…' — a caps label the robot wrote, before a dash.
  const h = text.match(/^([A-Z0-9][A-Z0-9 /&'-]{2,40}?)\s+[—–-]\s+/)
  if (h && h[1] && /[A-Z]/.test(h[1]) && h[1] === h[1].toUpperCase()) {
    heading = humanizeHeading(h[1])
    text = text.slice(h[0].length).trim()
  }
  // Keep the sentence that asks; the working detail belongs on the shell's ledger, not in the tap.
  const question = text.length > TWIN_QUESTION_MAX_CHARS ? lastQuestionSentence(text) : text
  const choices = defaultChoices(question)
  return { heading, question, choices, recommended: null, topic: topicSlug(heading ?? question.split(/\s+/).slice(0, 6).join(' ')) }
}

/** The last '?'-terminated sentence of an over-long part, so the draft starts inside the limit. */
function lastQuestionSentence(text: string): string {
  // Split only where an ender is followed by whitespace, so '1.6×' and '$37.4k' stay whole.
  const sentences = text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
  const asks = sentences.filter((s) => s.endsWith('?'))
  const pick = asks[asks.length - 1] ?? sentences[sentences.length - 1] ?? text
  return pick.length > TWIN_QUESTION_MAX_CHARS ? clip(pick, TWIN_QUESTION_MAX_CHARS) : pick
}

/**
 * Split a legacy multi-decision ask into one draft per decision. Numbered parts
 * '(1) … (2) …' (or '1) …') are the seams; an 'Also confirm: …' clause inside a
 * part is its own decision. Text before the first marker is the preamble.
 */
export function splitLegacyAsk(question: string): LegacyAskSplit {
  const text = question.replace(/\s+/g, ' ').trim()
  const seams: number[] = []
  MARKER.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MARKER.exec(text)) !== null) seams.push(m.index)
  const parts: string[] = []
  let preamble: string | null = null
  if (seams.length === 0) {
    parts.push(text)
  } else {
    preamble = text.slice(0, seams[0]).trim() || null
    for (let i = 0; i < seams.length; i++) {
      const start = seams[i] as number
      const end = i + 1 < seams.length ? (seams[i + 1] as number) : text.length
      parts.push(text.slice(start, end).replace(MARKER, ' ').trim())
    }
  }
  const decisions: LegacyDecisionDraft[] = []
  for (const part of parts) {
    const [main, ...alsos] = part.split(ALSO)
    const first = draftFromPart(main ?? '')
    if (first) decisions.push(first)
    for (const a of alsos) {
      const d = draftFromPart(a)
      if (d) decisions.push({ ...d, heading: d.heading ?? (first?.heading ? `${first.heading} · also` : null), topic: first ? `${first.topic}-also` : d.topic })
    }
  }
  return { preamble, decisions }
}

/** The v2.3210 rule's objections to a draft, empty when it may post. */
export function draftProblems(d: Pick<LegacyDecisionDraft, 'question' | 'choices' | 'recommended'>): string[] {
  const r = checkEstimatorQuestionShape({ question: d.question, choices: d.choices, recommended: d.recommended ?? undefined })
  return r.ok ? [] : r.problems
}

export interface LegacyAskSource {
  id: string
  twin_user_id: string
  about_bid_id: string | null
  mission: string | null
}

export interface SplitQuestionInsert {
  twin_user_id: string
  about_bid_id: string | null
  mission: string
  status: 'open'
  audience: 'estimator'
  kind: 'decision'
  topic: string
  question: string
  choices: string[]
  recommended: string | null
}

/**
 * The stamp every posted split carries in its mission, so a retry can find what
 * an earlier Post already wrote (v2.3236: the first live Post inserted its four
 * rows, then the session died before the original was retired — a second press
 * would have posted them twice).
 */
export function splitMissionTag(sourceId: string): string {
  return `split from ${sourceId.slice(0, 8)}`
}

/** Rows an earlier Post already wrote for this source — match on the mission stamp. */
export function alreadySplitRows<R extends { mission: string | null }>(rows: readonly R[], sourceId: string): R[] {
  const tag = splitMissionTag(sourceId)
  return rows.filter((r) => (r.mission ?? '').includes(tag))
}

/** The rows the Console posts as the robot — one open one-tap question per draft. */
export function buildSplitInserts(source: LegacyAskSource, drafts: readonly LegacyDecisionDraft[]): SplitQuestionInsert[] {
  const mission = `${source.mission?.trim() || 'legacy ask'} · ${splitMissionTag(source.id)}`
  return drafts.map((d) => ({
    twin_user_id: source.twin_user_id,
    about_bid_id: source.about_bid_id,
    mission,
    status: 'open',
    audience: 'estimator',
    kind: 'decision',
    topic: d.topic || topicSlug(d.question.split(/\s+/).slice(0, 6).join(' ')),
    question: d.question.trim(),
    choices: d.choices.map((c) => c.trim()).filter(Boolean),
    recommended: d.recommended && d.choices.includes(d.recommended) ? d.recommended : null,
  }))
}

/** What the retired original carries on its ledger row, so a reader knows where the decisions went. */
export function splitRetirementAnswer(count: number): string {
  return `Re-asked as ${count} one-decision question${count === 1 ? '' : 's'} from the Console.`
}
