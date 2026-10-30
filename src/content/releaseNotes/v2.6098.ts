import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6098',
  date: '2026-10-29',
  title: 'Quickfill: Messages is the round’s second station, with the Texts ledger folded in',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Quickfill has a Messages station, second after Today’s lines. It shows the page’s lanes with their counts: New, Needs you, Needs a reply, We owe them and Waiting on them. Open on a lane lands on it on Messages, and Answer all opens the reply desk. The count is everyone waiting on us, each person once, the same number as the header’s badge.',
    'The Texts station folds into it as the first fold, with everything it had: Reply and Call, the texts not delivered, the day’s receipt, the quiet lines and Anything else. Its marks and its history are kept under Messages, and a link to the old station lands on the new one.',
    'On Quickfill, Today’s lines no longer lists the Customers line or Today’s sends, since the station carries both. The Dashboard’s Needs you card keeps them.',
    'The station’s Next line names the person waiting longest, and its Mark records who was still waiting at each look.',
  ],
}

export default note
