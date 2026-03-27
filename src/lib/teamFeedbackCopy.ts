/** Default Team Feedback copy when `team_feedback_settings` columns are null. */

export const DEFAULT_INCLUSION_TITLE = 'What would you like to include?'

export const DEFAULT_INCLUSION_SUBTITLE =
  'Pick at least one. You can use only written feedback, only ratings, or both.'

export const DEFAULT_INCLUSION_LABEL_MANAGER = 'Manager ratings'

export const DEFAULT_INCLUSION_LABEL_PEER = 'Peer ratings'

export const DEFAULT_INCLUSION_LABEL_OPEN = 'Open comments'

export const DEFAULT_MANAGER_STEP_HEADING = 'About your lead / manager'

export const DEFAULT_MANAGER_OVERALL_PROMPT =
  'Overall, how satisfied are you with leadership support? (1–10)'

export const DEFAULT_PEER_STEP_HEADING = 'About your teammates'

export const DEFAULT_MANAGER_LIKERT_PROMPTS: readonly string[] = [
  'My manager clearly explains the job scope, parts needed, and customer expectations before I leave the shop.',
  'My manager is quick and helpful when I call with problems on the job (parts, technical, or customer issues).',
  'My manager assigns jobs, overtime, and tough calls fairly.',
  'I feel safe bringing up safety concerns or improvement ideas with my manager.',
  'My manager gives clear, useful feedback that actually helps me do my job better.',
]

export const DEFAULT_PEER_LIKERT_PROMPTS: readonly string[] = [
  'This person shows up prepared and on time.',
  'This person does quality work with good attention to detail.',
  'This person is willing to help teammates when a job gets tough.',
  'This person communicates clearly and professionally on the job site.',
  'I would trust this person as my partner on a complex or high-pressure job.',
]

/** Returns fallback if value is not a JSON array of exactly 5 non-empty strings. */
export function normalizeLikertPrompts(
  value: unknown,
  fallback: readonly string[]
): string[] {
  if (!Array.isArray(value) || value.length !== 5) return [...fallback]
  const out: string[] = []
  for (const v of value) {
    if (typeof v !== 'string' || !v.trim()) return [...fallback]
    out.push(v.trim())
  }
  return out
}
