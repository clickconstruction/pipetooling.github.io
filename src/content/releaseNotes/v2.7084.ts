import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7084',
  date: '2026-11-13',
  title: 'Messages: a run that files the mail we already have onto its jobs',
  kind: 'feature',
  highlights: [
    'A developer can now run a count of the old mail in the office mailboxes that belongs to each open job. The count files nothing.',
    'The run files a conversation only when it is sure of the job: the mail names it, names its street, or comes from a customer with one job.',
    'Everything it files is filed for the record, so nothing lands in New or asks for a reply.',
    'A customer with several jobs is never guessed. Those conversations go on a sheet for a person to place.',
  ],
}

export default note
