import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4024',
  date: '2026-09-28',
  title: 'A test-mode bill no longer emails the people copied on it',
  kind: 'fix',
  highlights: [
    'Sending a test-mode Stripe bill kept the payer’s email away from the customer, but the copies still went to the real people on the bill’s copy list — the customer’s contacts, the GC, a one-off address — with a Pay link to a test invoice. They now get nothing.',
    'One copy comes to whoever pressed Send instead, marked [Test], with a line naming the addresses it did not go to. It carries no statement link, since it stands in for the whole list.',
    'The confirm says so before you send (“One copy comes to you too; nothing goes to …”), the toast says so after, and the send history lists copies only for the people a copy reached.',
    'Live bills are unchanged: everyone on the copy list gets their own copy.',
  ],
}

export default note
