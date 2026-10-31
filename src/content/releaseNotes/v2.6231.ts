import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6231',
  date: '2026-10-31',
  title: 'Messages: an addendum lands on its bid, and the notices set aside are counted with Put back',
  kind: 'feature',
  highlights: [
    'An email whose subject names a bid we are pricing now lands on that bid’s thread, whoever sent it. An addendum makes no row in New: the estimator sees it on the bid.',
    'The app writes down each notice it sets aside on its own, a marked sender’s mail or one that says unsubscribe at its foot. Under New a fold counts them: 3 notices set aside this week. Open it to see each sender and subject.',
    'Was one a real message? Press Put back. The next read takes it after all, within a few minutes. Nothing in Gmail changes either way.',
  ],
}

export default note
