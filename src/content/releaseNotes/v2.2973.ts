import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2973',
  date: '2026-09-06',
  title: 'Safety net under the customer estimate copy',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The wording customers see on an estimate — the email, the acceptance page, the thank-you, the change-order variant, and every override layer — now has 48 tests, including one that fails if the copy the server emails ever drifts from the copy the page shows.',
  ],
}

export default note
