import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6219',
  date: '2026-10-31',
  title: 'A report photo answers a stage checklist question',
  kind: 'feature',
  highlights: [
    'On the phone’s field report, under a new photo, the chips that ask which stage it shows now also offer the stage checklist’s questions that ask for a photo. It reads Or it answers a checklist question, with one chip per question, like Rough In · Did the water test hold?',
    'Tap the question. The photo sits on that stage’s row, the tile reads Answers: Did the water test hold?, and Save writes the photo onto the question. The stage checklist then shows it with Taken on a field report, and the question counts as answered once you pick Yes or No.',
    'The photo is still a report photo: one copy, filed in the customer’s Drive folder and named by the stage and the question. The report’s Stage progress line counts it, as in 2 photos on Rough In, 1 answers a checklist question.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary'],
}

export default note
