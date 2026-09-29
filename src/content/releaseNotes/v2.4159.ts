import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4159',
  date: '2026-09-29',
  title: 'Job Mode: hand the phone to the customer to sign',
  kind: 'feature',
  highlights: [
    'Clocked in on a job with no signed agreement? The Job Mode card offers one tap: Hand the phone to the customer to sign. It opens the job’s agreement on this phone, in person, the way the office’s Contract window does with Sign here, now.',
    'It reuses the agreement already out on the job, or makes one from the job’s own facts — scope from the fixtures or the accepted estimate, the job’s amount, the Contract Book’s current terms. Nothing is emailed until the customer signs; their signed copy goes to the email on the job.',
    'The door shows for the roles that speak for the company on site — master, primary, superintendent, estimator — and disappears once the job is signed.',
  ],
}

export default note
