import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8107',
  date: '2026-11-20',
  title: 'The app’s first file is 70% smaller than this morning: the older public pages load with their link',
  kind: 'infra',
  highlights: [
    'A customer’s, a sub’s or a lawyer’s page now loads only when its link is opened. It used to load for everyone on every visit.',
    'The pay link, the customer portal, the sub portal, the estimate and contract pages and the legal portal are among them.',
    'The file every visit loads first is now 2.8 MB, where it was 9.5 MB this morning.',
  ],
}

export default note
