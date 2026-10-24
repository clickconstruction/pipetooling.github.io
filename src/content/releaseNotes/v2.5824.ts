import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5824',
  date: '2026-10-24',
  title: 'Quickfill Email: choose which inboxes and labels the app counts, and who sees them',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'Settings → Phone and texts has a new card, Mail the app counts, for the owner and a dev. Add a shared inbox such as work@, add a teammate to count their own inbox, choose the labels for each, set how many days is too long, and pick the one lead who sees everyone’s rows.',
    'A teammate the owner adds finds Mail Quickfill counts under Settings → Your account. It says which of their labels are counted, what is kept and who sees it. They can take a label off, add one, or switch their own count off.',
    'Switching a count off, or taking a label off, makes the app forget the threads it kept for it. The app keeps senders, subjects and dates only, never the words of an email.',
  ],
}

export default note
