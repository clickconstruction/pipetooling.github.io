import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5629',
  date: '2026-10-19',
  title: 'The right words first: a job’s box opens on the lines for its stage',
  kind: 'feature',
  highlights: [
    'Press Text or Email on a job, from the Pipeline’s customer sheet or the job window, and the quick replies open on their own with the lines for the job’s stage first, under For this stage. One press fills the box.',
    'A job in Billed Awaiting Payment leads with the payment reminder, then the line that says the bill went out; a job in Working leads with the Working line. Where the office has not written a line for a stage yet, the app’s own words stand in.',
    'The job window’s speech bubble beside the customer’s name now opens the same customer sheet the Pipeline row opens, instead of leaving for Messages.',
    '“This is {me}” now fills with your own name in a job’s box, as it already did in a thread.',
  ],
}

export default note
