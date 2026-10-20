import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5517',
  date: '2026-10-13',
  title: 'Bids: the ground for combining two CountTooling counts on one bid',
  kind: 'feature',
  roles: ['dev', 'estimator', 'master_technician', 'assistant'],
  highlights: [
    'A bid can now remember every CountTooling project behind its counts, and each count row can remember each project’s share of its count. Nothing changes on screen yet; the review that adds a second counter’s copy instead of replacing arrives in the next release.',
    'The copy from CountTooling now tells PipeTooling which project it came from, by the token in its link and the project name in its heading.',
  ],
}

export default note
