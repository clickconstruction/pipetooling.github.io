/**
 * A GC's proposal of stricter settings for a job's paper (punch list #389, step 6), as both sides word it. The GC
 * proposes on their page and the office takes it or declines. The database decides every rule
 * (`20261125023655_job_paper_gc_proposals.sql`). This says them first, so a press reads right before it is pressed.
 * Pure: no React, no supabase, no clock.
 */
import { choiceOf, choiceRank, type PaperPicks, type PaperSetting, type SettingsDef } from './paperSettings'
import { picksChange } from './jobPaperSettings'

/** Where a proposal stands. Overtaken: a newer one, a change of the paper's settings, or the paper came off the job. */
export type ProposalState = 'waiting' | 'taken' | 'declined' | 'overtaken'

/** One topic a proposal moves: its name, and the choice it leaves and the choice it asks for. */
export interface ProposalChange {
  key: string
  label: string
  from: string
  to: string
  /** The plain words the summary says for the choice asked for. */
  says: string
}

/** The topics a proposal moves, in the list's order. A topic it leaves alone is not listed. */
export function proposalChanges(def: SettingsDef, from: PaperPicks | null, to: PaperPicks | null): ProposalChange[] {
  return def.settings.flatMap((s) => {
    const was = choiceOf(def, s.key, from?.[s.key])
    const goes = choiceOf(def, s.key, to?.[s.key])
    if (!goes || was?.key === goes.key) return []
    return [{ key: s.key, label: s.label, from: was?.label ?? 'Not set', to: goes.label, says: goes.says }]
  })
}

/** The choices a GC may pick for a topic: the job's own and every stricter one, the loosest first. */
export function stricterChoices(def: SettingsDef, setting: PaperSetting, pick: string | undefined): PaperSetting['choices'] {
  const floor = Math.max(0, choiceRank(def, setting.key, pick ?? ''))
  return setting.choices.slice(floor)
}

/** What the database says to a proposal it refuses, so the page can say it before the press. */
export const PROPOSAL_WORDS = {
  nothing: 'Nothing is stricter yet. Move a topic to a stricter stop first.',
  looser: 'A proposal can only make the paper stricter.',
  name: 'Type your name first.',
  notice: 'Tick the box under the notice first.',
} as const

/**
 * What stops a proposal from going, in the order the page asks for things, or null when it can go. The database
 * checks the same four.
 */
export function proposalProblem(p: { def: SettingsDef; from: PaperPicks; to: PaperPicks; name: string; hasNotice: boolean; ticked: boolean }): string | null {
  const change = picksChange(p.def, p.from, p.to)
  if (change === 'same') return PROPOSAL_WORDS.nothing
  if (change !== 'stricter') return PROPOSAL_WORDS.looser
  if (p.hasNotice && !p.ticked) return PROPOSAL_WORDS.notice
  if (p.name.trim() === '') return PROPOSAL_WORDS.name
  return null
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** The office's take, worded before the press: what it saves and who signs again. `signed` counts this paper's signers. */
export function takeWords(signed: number): { press: string; title: string; lines: string[]; confirm: string } {
  if (signed > 0)
    return {
      press: `Take it, and ask ${count(signed, 'person', 'people')} to sign again`,
      title: 'Take the GC’s proposal?',
      lines: [
        'The paper gets the stricter settings as a new version.',
        `${count(signed, 'person has', 'people have')} signed this paper. Each signs the new version again, and the job stays closed to each until then.`,
      ],
      confirm: `Take it, and ask ${count(signed, 'person', 'people')} to sign again`,
    }
  return {
    press: 'Take it',
    title: 'Take the GC’s proposal?',
    lines: ['The paper gets the stricter settings.', 'Nobody has signed yet, so nobody signs again.'],
    confirm: 'Take the proposal',
  }
}

/** What the office reads once it has answered, as the toast says it. */
export function decidedWords(answer: { took: boolean; signAgain: number }): string {
  if (!answer.took) return 'The proposal is declined. The GC’s page says so.'
  return answer.signAgain > 0
    ? `The proposal is taken. ${count(answer.signAgain, 'person signs', 'people sign')} the new version again.`
    : 'The proposal is taken. Nobody signs again.'
}

export const DECLINE_WORDS = {
  press: 'Decline…',
  title: 'Decline the GC’s proposal?',
  line: 'The paper stays as it is. The GC reads your reason on their page.',
  whyLabel: 'Why, for the GC to read',
  confirm: 'Decline the proposal',
} as const

/** The head of the office's card: who proposed, and that it waits. */
export function proposalHead(byName: string, day: string | null): string {
  const who = byName.trim() || 'The GC'
  return day ? `${who} proposed stricter settings on ${day}` : `${who} proposed stricter settings`
}
