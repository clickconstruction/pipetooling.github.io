import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6279',
  date: '2026-11-01',
  title: 'My email: later mail in a tagged conversation lands by itself',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Tag a conversation from your own mail onto a job, and its next mail lands there within five minutes. Their replies and your answers both land, with their files, and nothing is written twice.',
    'A grey line on the thread says who tagged the conversation and that later mail lands by itself. Untag takes the line off with the rest.',
    'An untag now knows when the Legal desk already put the conversation on a matter. The matter keeps its own copy.',
  ],
}

export default note
