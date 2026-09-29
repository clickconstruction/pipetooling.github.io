import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4157',
  date: '2026-09-29',
  title: 'Settings → Data & recovery: sweep ZZ test jobs off the Pipeline',
  kind: 'feature',
  highlights: [
    'A new dev section lists every job whose name or customer starts with "ZZ" — the residue live passes and robot runs leave on the Pipeline — with its status, total and age.',
    'Sweep one row, or all rows older than a chosen age (7 days by default), into the sink: the one ZZ job kept on purpose, named "ZZ TEST sink". Each sweep zeroes the job total, clears its lines, and moves costs, hours, notes and reports the same way Reassign to another job… does — so the swept job sits in Recently deleted for 90 days.',
    'Newer rows stay put, in case a pass is still using them; the sink is found by its name, never by number, and if there is none the section says so and sweeps nothing.',
  ],
}

export default note
