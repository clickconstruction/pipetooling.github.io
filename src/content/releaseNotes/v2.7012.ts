import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7012',
  date: '2026-11-12',
  title: 'Pipeline: the hazmat fee button shows on Waiting, Working and Ready to Bill only',
  kind: 'fix',
  highlights: [
    'The orange biohazard button is gone from rows in Billed Awaiting Payment, Collections and Paid in Full, at the desk and on the phone. It stays on Waiting, Working and Ready to Bill.',
    'On the phone, a Ready to Bill job now lists Hazmat fee in its sheet too, as Waiting and Working jobs already did.',
    'Found an exposure after the bill went out? Press Send back on the row, then the biohazard button in Ready to Bill. The fee rides on the bill you send next.',
    'A fee already on a billed job is untouched. Its notice, PDF and email presses are still in Edit Job, under Line Items.',
  ],
}

export default note
