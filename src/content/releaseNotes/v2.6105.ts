import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6105',
  date: '2026-10-29',
  title: 'Legal desk: the money drawn as bars — the bills, the claim with every offer on it, and what is left',
  kind: 'feature',
  highlights: [
    'Under the four questions the same money is drawn: On the bills has one block per open bill, oldest first, with a bracket under a job’s bills for the retainage those bills already carry.',
    'The claim appears when something reaches past the bills: the bills as one block, the retainage no bill asks for yet, and a hatched stretch to the largest offer or the floor, with every standing offer and the settlement floor as marks on it.',
    'What’s left draws what we keep, the firm’s cut and the filing cost, on the claim and, when the claim is larger, on the bills alone.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
