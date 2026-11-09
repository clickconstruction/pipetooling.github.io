import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6776',
  date: '2026-11-09',
  title: 'The superintendent’s line reads the hours frozen at award, the lines’ sum beside them',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'superintendent'],
  highlights: [
    'The Projects board’s card and the superintendent’s phone card read their hours budget from the hours frozen at award, the same number the Scoreboard scores, and say “frozen at award” after the source. A project awarded before baselines were frozen keeps the live row, and a target the leader set still outranks both.',
    'The Costs tab’s Where we are card reads the clocked hours against the hours frozen at award and says what the line budgets sum to beside them. A note under the bars names which hours the score reads and that the lines’ sum is the line-by-line view, never scored.',
    'The two guides say so: give a project its hours baseline at award, and see where every project stands.',
  ],
}

export default note
