import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3793',
  date: '2026-09-23',
  title: 'The “signed” email says who and how much',
  kind: 'fix',
  highlights: [
    'When a customer accepts an estimate, the email the office gets now reads “Dana Ruiz signed — $4,250” instead of “Signed — Estimate for Dana Ruiz — $0 (Estimate #150)”. The work is added only when someone gave the estimate its own title.',
    'The amount was always $0 on accepted estimates — it now shows the real total, or the total of the option the customer chose.',
    'A signed bid-room proposal reads “Knight Contracting signed — $56,343 · Hunter Road Sound Studio”, and the line under the subject in your inbox says whether the job was created.',
  ],
}

export default note
