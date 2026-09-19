import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3614',
  date: '2026-09-19',
  title: 'Supervision, PR 4: Rate my crew — a supervisor\'s monthly sliders, by name, beside the office\'s',
  kind: 'feature',
  highlights: [
    'Once a month, My crew on the Dashboard counts the people you supervised on two or more days and offers Rate my crew: one card per person, the three sliders with a word on why, Save · next or Skip. One rating per person per month; open it again to change one.',
    'Your ratings land on Hiring → Review beside the office\'s, with a green "supervisor" chip, by name — the people who hire see what the people who supervise saw.',
    'The write is checked in the database against the schedule and the clock: you can only rate someone you shared a job-day with that month while able to run a job. No list to keep.',
  ],
}

export default note
