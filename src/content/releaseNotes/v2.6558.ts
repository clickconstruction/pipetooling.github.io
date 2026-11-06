import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6558',
  date: '2026-11-05',
  title: 'The Development page’s Scoreboard cuts by part of the site or by person, and windows to this month or 90 days (punch list #250 closed)',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'Two chip rows sit above the Scoreboard. Cut by job, part of the site or person. Window all time, this month or 90 days. The page remembers both on your device.',
    'Cut by part of the site draws each part as a row with its jobs under it, so you read which building paid. Jobs on no part come last.',
    'Cut by person turns the grid over: each person who clocked on the site is a row with their hours, days and labor, and their share of each job’s earned dollars by hours, marked ≈. Open a person to see their jobs.',
    'A window cuts every figure to its days: the clock’s hours and labor, the subs and parts dated inside it, the overhead day share, and earned by the hours in it. This was the card’s last PR, so punch list #250 closes.',
  ],
}

export default note
