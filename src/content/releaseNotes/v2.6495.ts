import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6495',
  date: '2026-11-04',
  title: 'Dispatch opens a stage check in its own window and replies to the crew',
  kind: 'feature',
  highlights: [
    'Pressing a stage check in the Dispatch inbox opens a window with everything the crew saw: the job, the address, the stage and its count, the check and the pick so far, then the crew’s words and every reply.',
    'Reply sends the crew member a push and sits under the check’s row on their sheet until they answer it. Reply and close ends the request with those words. The person who sent the check never closes their own.',
    'Lower priority and Not now sit in the window too. Open the check and Open the job stay on the row.',
    'On the sheet, a pick, a skip or a take off on a check that is with Dispatch clears the chip and tells the sender how it was settled.',
  ],
  roles: ['dev', 'assistant', 'estimator', 'master_technician', 'superintendent', 'primary', 'helpers', 'subcontractor'],
}

export default note
