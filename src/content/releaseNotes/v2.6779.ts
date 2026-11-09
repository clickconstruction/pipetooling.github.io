import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6779',
  date: '2026-11-09',
  title: 'The scoreboard prices labor kept at the roster’s loaded rate, and a $2,500 floor keeps small jobs off the deck and the board',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'Labor kept is now the hours earned at the signed-off percent priced at the roster’s loaded rate, the last 90 days of field wages at the burden factor, minus the actual labor cost. The line budgets’ rate stays the bid’s price. The rule card on People → Review → Scoreboard names the rate the month was priced at, and says when the roster had no field hours and each job read its award’s own rate.',
    'A project priced under $2,500 never appears on the Needs you baseline deck or on the Scoreboard. A project with no price yet still does.',
    'The rule card also says the score reads the hours frozen at award and never the line budgets’ sum. The two guides say the same.',
  ],
}

export default note
