import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6093',
  date: '2026-10-29',
  title: 'Quickfill: Job follow-ups gets an Idle lane, with the Follow-ups deck in place',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The Job follow-ups station on Quickfill now has two lanes. Quiet is the jobs quiet too long for their stage. Idle is the Working and Waiting jobs with no crew on site in 21 days or more, with the contract behind them and how many are yours.',
    'Review them on either lane opens the Follow-ups deck right there on Quickfill, on that lane, with the same cards as the Pipeline: a note, Looks fine, Snooze and the door. Closing it re-reads the lanes.',
    'The station’s count is both lanes, each job once, and its Next line is the stalest quiet job, else the job longest without a crew and what it needs.',
    'The idle jobs’ line leaves Today’s lines on Quickfill, since the station carries it. The Dashboard’s Needs you card keeps the line and its door.',
  ],
}

export default note
