import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8682',
  date: '2026-11-26',
  title: 'Bill Customer: a voided test bill leaves a record a developer can read',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Void invoice deletes the bill from the job, and the rows of its sends went with it. Nothing in the app was left to read.',
    'A voided bill of a ZZ test job now leaves a record first: the bill as it stood, its sends, what was done in Stripe, who voided it and when.',
    'On that test job the developer reads Voided test bills at the foot of Bill Customer. It is a record to read, and nothing in it can be pressed.',
    'Nothing changes for the office. A real job’s bill is voided exactly as before and leaves no record.',
  ],
}

export default note
