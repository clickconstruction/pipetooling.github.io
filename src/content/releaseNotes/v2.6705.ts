import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6705',
  date: '2026-11-08',
  title: 'Legal desk: the people on a matter, and the letters pick from them',
  kind: 'feature',
  highlights: [
    'The Account tab of a matter now carries People on the matter: everyone the case touches, each with a role (their president, their billing, owner of record, tenant, inspector, our counsel, a witness), an organization, how to reach them, and how letters use them. Letters means a letter’s To, copies means a copy, never means they cannot be picked and the row says why, like “never — bounces” or “never — a witness, not a recipient”.',
    'Press Add the people the record knows and the list starts from the customer record, its contacts and each property’s owner of record, every row saying where it came from. Add a person, Edit and Take them off the matter… are the office’s; a removed row stays on the record.',
    'The final demand letter reads the list. Above Who owes it, From the matter’s people shows the To rows as chips in the same shape as the To chip in Messages, the copies beside them, and the rows that refuse greyed with their reason. Press a To and the letter’s recipient, email and mailing address fill from the person.',
    'The same migration makes room for the proceedings beside the claim (an agency complaint, a records request), which the next release draws.',
  ],
}

export default note
