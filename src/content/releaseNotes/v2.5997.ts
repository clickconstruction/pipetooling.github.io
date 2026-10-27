import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5997',
  date: '2026-10-27',
  title: 'Tell the customer the date moved, with the same link',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'estimator', 'superintendent', 'dev'],
  highlights: [
    'After Extend good-through, a tick on the panel emails the customer the same letter again, with the new date and the link they already have. It starts ticked when the old date had passed.',
    'Nothing about the link changes, so a city that passed the link around keeps every copy working. Resend link still makes a fresh link when you want the old one dead.',
    'What went now lists every letter sent again, and says whether it kept the link or made a fresh one.',
  ],
}

export default note
