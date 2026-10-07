import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4835',
  date: '2026-10-07',
  title: 'Lien window: record a lien that was filed without the app',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Mechanic’s lien tab, a new Already filed — record it… button sits under the gate list, even while a gate is still red.',
    'Type the county, the recording number and the day the County Clerk stamped it. The serve-by day and the year to sue count from that day, and the Lien desk and the Deadlines read the lien as filed.',
    'Before this, a lien filed by counsel or on paper from elsewhere could not be recorded until every gate cleared, so the desk kept saying the lien was gone.',
  ],
}

export default note
