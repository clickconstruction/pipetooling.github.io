// Try-out loop, PR 2 (to-dos/helper-tryout-loop): the words of the push a leader gets when a trial
// helper clocks out, and where it opens. Shared by notify-team-lead-clock and the client's card so
// the two say the same thing. By name, never "him" / "her".
// Pure: no env reads, no network.

/** The Dashboard section the push opens onto (the card sits at the top until answered). */
export const TRIAL_VERDICT_DEEP_LINK = '/dashboard#trial-verdicts'

/** The first word of the name; null when there is no name to use. */
export function firstNameOf(name: string | null | undefined): string | null {
  return (name ?? '').trim().split(/\s+/)[0] || null
}

export function trialVerdictQuestion(helperName: string | null | undefined): string {
  const first = firstNameOf(helperName)
  return first ? `Take ${first} again?` : 'Take them again?'
}

export function trialVerdictPush(helperName: string | null | undefined, jobName: string | null | undefined): { title: string; body: string; url: string } {
  const first = firstNameOf(helperName)
  const job = (jobName ?? '').trim()
  return {
    title: 'Trial helper',
    body: `${first ?? 'Your trial helper'} clocked out${job ? ` of ${job}` : ''} — take ${first ?? 'them'} again?`,
    url: TRIAL_VERDICT_DEEP_LINK,
  }
}
