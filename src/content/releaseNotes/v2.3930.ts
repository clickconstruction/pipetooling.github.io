import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3930',
  date: '2026-09-27',
  title: 'Record payment: the employee-credit form says why it would not save',
  kind: 'fix',
  highlights: [
    'On Payroll → Record payment → Record employee credit…, a refusal from the Add offset form — no amount, no person, a save that failed — now shows as a message. It used to fail without a word.',
    'The Record payment window is its own piece with its own tests; it looks and works as before.',
  ],
}

export default note
