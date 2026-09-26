import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3849',
  date: '2026-09-26',
  title: 'Lien letters and notices name the job’s trade',
  kind: 'fix',
  highlights: [
    'Counsel’s cover letters, the retainage cover letter and the § 53.056 form now take the trade from the job’s service type: an electrical job’s letter says “We are the electrical contractor on your project” and its form defaults to “Electrical labor and materials”. Before, every letter said plumbing whatever the job was.',
    'A plumbing job reads exactly as counsel wrote it, and a job with no service type still reads as plumbing. The form’s type of labor can still be retyped on the paper.',
    'The affidavit’s work description follows the same rule when the job has no name.',
  ],
}

export default note
