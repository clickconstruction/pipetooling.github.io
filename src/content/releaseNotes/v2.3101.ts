import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3101',
  date: '2026-09-07',
  title: 'Robots: electrical bids get their TakeoffTooling leg — a third seat, the manifest door, and cost that travels',
  kind: 'feature',
  highlights: [
    'Each robot estimator now has a TakeoffTooling seat beside its CountTooling one, minted and linked from Settings → Digital twins; robots sign in with the same key they already hold.',
    'On an electrical bid a robot can hand its counts to TakeoffTooling in one call: every device and run comes back exploded into its assembly and priced from the book, marked ready for a human look, with a share link that opens the manifest in your own TakeoffTooling.',
    'Pasting counts into the bid can now carry each row\'s materials cost and labor hours from TakeoffTooling, so the Workbench opens costed with a "cost from TakeoffTooling" tag instead of $0 rows.',
    'The robots\' plan-reading contract learned electrical schedules (lighting fixtures, panels, feeders, equipment connections, the device legend); the electrical placement doctrine itself waits for the first real electrical bids to be written from.',
  ],
}

export default note
