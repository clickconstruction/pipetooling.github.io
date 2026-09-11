import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3330',
  date: '2026-09-11',
  title: 'Record payment knows Cash App; Advance is an offset kind',
  kind: 'feature',
  highlights: [
    'Record payment has a Cash App ID field. Paste the Transaction ID and the memo is written in the shape the Cash App reconcile reads, so that send is matched exactly and leaves the review list on its own.',
    'Add offset can file an Advance: pay sent ahead of a report, offered as a Less line the next time that person\'s report is generated. Offsets lists show it as Advance.',
  ],
}

export default note
