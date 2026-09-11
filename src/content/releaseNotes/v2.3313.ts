import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3313',
  date: '2026-09-11',
  title: 'Legal desk: attorney-ready is the release, and the office curates what the firm sees',
  kind: 'feature',
  highlights: [
    'A dev can now mark a Collections account attorney-ready from the Legal desk. That is the release: the account goes to the firm named on Settings → Jobs & dispatch → Collections law firm, with a handling person and a note, and Pull back brings it home.',
    'The office can ask a dev to review an account with one note, and the request goes to the top of the dev\'s new Needs You card ("N Collections accounts await your review before an attorney sees them"), which opens the desk on that account.',
    'On Their word, every contact, promise, call and collections note has a "to counsel" box. Entries before the first bill stay held unless you tick them; "Only after the first bill" and "Share all" set the whole list at once.',
    'Pipeline rows wear a ⚖ chip once an account is with the firm or a dev was asked; the firm\'s fee model (contingency %, filing cost) now drives "Click keeps"; writing down an account closes its matter.',
  ],
}

export default note
