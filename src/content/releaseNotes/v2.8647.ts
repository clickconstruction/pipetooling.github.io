import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8647',
  date: '2026-11-26',
  title: 'Hours: Reject and Delete on a clock session say whose session and which day',
  kind: 'fix',
  highlights: [
    'Reject asked Reject this clock session? and Delete asked Delete this clock session permanently? Neither said whose session or which day.',
    'Both windows now name the person, the day and the hours, and the buttons read Reject the session and Delete the session.',
    'The Delete window also says a dev can bring the session back from Recently deleted for 90 days.',
  ],
}

export default note
