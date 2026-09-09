import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3180',
  date: '2026-09-09',
  title: 'Job Summary table: cents in small type',
  kind: 'feature',
  highlights: [
    'Every dollar figure in the Jobs → Job Summary table — Revenue, Labor, Subs, Parts, Gross, Overhead and True profit — now shows its cents at the smaller size the tiles above it use, so the whole numbers read at a glance and the cents are still there.',
    'The totals footer, the Cut-by group subtotal rows and the fuel & gas line under Parts follow the same style. A loss keeps its minus sign and red color.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
