import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4390',
  date: '2026-10-02',
  title: 'Pipeline: a job with no price reads “no price yet” on the phone too',
  kind: 'fix',
  highlights: [
    'On a phone, a job with no priced line items now shows a red “no price yet” chip. It used to say “no bid value”, while the desktop and cards say “No price yet”.',
    'The Follow-ups window uses the same words.',
    'The guide for working the Pipeline from your phone is rewritten in plain words. It now lists the returned-check and lien chips too.',
  ],
}

export default note
