import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2225',
  date: '2026-08-24',
  title: 'Payment forecast email — the sender',
  kind: 'feature',
  highlights: [
    'The engine that builds and sends the Payment forecast email: the same buckets and expected dates as the modal, rebuilt fresh at send time.',
    'Past expected leads the email — the follow-up queue is the actionable part.',
    'The Email… button in the forecast modal arrives in the next update.',
  ],
}

export default note
