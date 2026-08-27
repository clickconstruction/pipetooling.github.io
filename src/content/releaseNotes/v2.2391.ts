import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2391',
  date: '2026-08-27',
  title: 'Cover Letter: Alternate waits for a second bid',
  kind: 'feature',
  highlights: [
    'With only one bid in the letter, flipping it to Alternate changed nothing — an alternate is offered in lieu of a base, and a lone alternate led the letter anyway. The Alternate button now sits disabled until a second bid joins the letter, and its tooltip says why.',
    'A bid already saved as a lone alternate keeps working exactly as before — and its Base button is one click away.',
  ],
}

export default note
