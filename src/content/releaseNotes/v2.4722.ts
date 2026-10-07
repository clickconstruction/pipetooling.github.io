import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4722',
  date: '2026-10-06',
  title: 'Lien desk: Share says who it is for',
  kind: 'fix',
  highlights: [
    'The Share panel now starts with To. It reads Someone in the office, a master, a controller or an assistant, and never a customer or a GC. The panel reads like an envelope: To, Which liens, the message, the buttons.',
    'What to send is now Which liens, so a GC’s name there reads as the liens it is about, not the person it goes to.',
    'The blue button reads Send to a teammate… where it read Send…. The email door already listed only the people who use the desk, and now says so.',
    'The fine print no longer says the message carries no money. The link carries none; the words above it do.',
  ],
}

export default note
