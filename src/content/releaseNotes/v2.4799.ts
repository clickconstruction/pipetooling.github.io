import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4799',
  date: '2026-10-06',
  title: 'GC mode: questions about the plans on real data, behind a dev door',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A company’s question about the plans is recorded with the trade and the sheets it is about, emailed to the architect with the project manager as the reply address, and answered in the app.',
    'A new set of plans carries each answer in its note, ticked by default. Questions close three days before our bid is due.',
    'Telling the companies comes with the company record. Only devs see it while the real build goes on.',
  ],
}

export default note
