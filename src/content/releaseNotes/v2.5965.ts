import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5965',
  date: '2026-10-27',
  title: 'A customer’s page says what went wrong in plain words',
  kind: 'fix',
  highlights: [
    'When a customer, GC, sub or owner page cannot open or send, it says what kind of problem it was. It never shows the server’s technical words.',
    'When our system wrote the reason for them, such as an offer that expired, they read that reason, in Spanish too on a Spanish page.',
    'With no signal it says No connection and offers Try again. Any other refusal asks them to call the office, with a Call the office button, or to try again later where the page has no number.',
    'The terms page, the fee notice, the law firm’s portal and confirm page, and the supply house quote page now do the same. A change order answered in the bid room, or an estimate declined, shows its own line.',
  ],
}

export default note
