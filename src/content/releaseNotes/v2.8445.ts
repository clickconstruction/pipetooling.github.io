import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8445',
  date: '2026-11-24',
  title: 'Bills sent: a test bill is in no total, in either view',
  kind: 'fix',
  highlights: [
    'A test bill no longer counts on Bills sent. That is a bill on a job or customer whose name starts with ZZ, or one made in Stripe’s test mode.',
    'By day sent still lists the send, marked A test bill. It is in no total. It is out of the day’s total, the Not paid tile and both payment chips.',
    'By day paid leaves out every payment on a ZZ test job. Before, it left out only test-mode bills, so a test payment typed by hand was added to its month.',
    'The yellow box no longer lists a ZZ test job’s bill as one with no send on record.',
  ],
}

export default note
