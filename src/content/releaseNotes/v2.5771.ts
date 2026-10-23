import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5771',
  date: '2026-10-23',
  title: 'Needs you on Quickfill: every office line the Dashboard shows, with the same buttons',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Quickfill’s Needs you station now carries every line the Dashboard card shows the office: checks that came back, the contract sweep, contracts out for signature a week, jobs that bought with no job account, test reports ready to send, the GC statements, the three Messages lines, the robot blocked on a folder, and the clock sessions waiting on approval.',
    'Each line’s button goes where it goes on the Dashboard. On Quickfill the clock sessions open the People Hours station on the same page.',
    'The two stations that already carry a line keep it (Job follow-ups, GC weekly review); the robot audits, Division 22 codes and submittals stay on the Dashboard on purpose.',
    'One table now says which lines each page reads and where each button goes, so the two pages cannot drift apart again.',
  ],
}

export default note
