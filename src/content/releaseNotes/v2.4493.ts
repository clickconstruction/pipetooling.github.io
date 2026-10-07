import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4493',
  date: '2026-10-04',
  title: 'AIA G702-G703: an offer to drop retainage to 5% past halfway',
  kind: 'feature',
  highlights: [
    'Once a job is past 50% complete and more than 5% is held, the AIA window offers to drop retainage to 5%.',
    'The offer shows what is held now, what would be held at 5%, and how much more would be due.',
    'Use 5% applies it to everything to date. Nothing changes until you press it, since not every contract drops retainage.',
  ],
}

export default note
