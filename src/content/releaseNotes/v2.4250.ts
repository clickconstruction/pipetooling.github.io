import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4250',
  date: '2026-09-30',
  title: 'GC Review: Preview shows the email right there, not in a separate window',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Pressing Preview on a GC statement now lays the email over the dialog, full size. You are looking at it the moment you press the button. There is no other window to go and find, and no pop-up to allow.',
    '← Back (or Esc) returns you to the dialog with the To, the CC and the subject exactly as you left them. Nothing is sent by previewing.',
    'The Preview of the week’s list email, on the Scheduled tab, opens the same way.',
    'A link inside the previewed email, such as the GC’s portal address, still opens in a tab of its own.',
  ],
}

export default note
