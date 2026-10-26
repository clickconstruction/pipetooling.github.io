import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5924',
  date: '2026-10-26',
  title: 'His signing code signs the lien waiver too',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The leader\'s signing code (the one from the Lien desk) now works in the Release of Lien window. When he is at your screen and has a code set, his name waits in the cursive face on the line and he types his code instead of drawing.',
    'The code is checked in the database, never on the screen: five wrong tries lock it for fifteen minutes, and the wrong-code message says how many tries are left. Draw instead brings the pad back.',
    'The record says what happened — "Typed by Malachi with his signing code … on Wendi\'s screen" — on the page, the PDF, and every copy, with the ESIGN and UETA line as always.',
    'He gets a push the moment his code signs a waiver on another screen, naming the job, the form and the amount. If it was not him, he changes the code under Settings and the office voids the waiver.',
  ],
}

export default note
