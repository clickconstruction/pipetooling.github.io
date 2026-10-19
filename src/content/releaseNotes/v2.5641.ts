import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5641',
  date: '2026-10-19',
  title: 'Quick replies fill in what a customer still owes',
  kind: 'feature',
  highlights: [
    'A quick reply with {amount} now fills with what is still open on the customer’s bill, the same amount the AR page shows, and {number} with the job’s number.',
    'From a job, the line speaks of that job’s newest open bill. From a customer’s thread, of their newest open bill on any job. {bill} links to the same bill.',
    'The quick replies window offers two new blanks, {number} and {estimate}. {estimate} fills once estimates can be shared by text.',
  ],
}

export default note
