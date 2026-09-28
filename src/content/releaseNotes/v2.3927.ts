import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3927',
  date: '2026-09-27',
  title: 'Workflow: the Expected dates window and the invoice search have tests',
  kind: 'fix',
  highlights: [
    'In the Expected dates window, typing a start, an end or a length moves the other two. That arithmetic — and the start a step borrows from the step before it — lived inside the Workflow page with no test. It now lives in one module with twenty-nine.',
    'The search box for adding a supply house invoice to a step is one tested rule, used by both the Workflow page and the Forecast’s stage window.',
    'Nothing on screen changes.',
  ],
}

export default note
