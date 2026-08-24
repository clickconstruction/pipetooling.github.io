import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2223',
  date: '2026-08-24',
  title: 'Payment forecast email — the plumbing',
  kind: 'feature',
  highlights: [
    'Groundwork for emailing the Payment forecast: scheduled sends now have a home in the database, and your email schedule knows about them.',
    'The Email… button itself lands in the next update.',
  ],
}

export default note
