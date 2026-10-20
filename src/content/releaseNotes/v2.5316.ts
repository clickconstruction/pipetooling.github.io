import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5316',
  date: '2026-10-12',
  title: 'Messages: the flows editor takes papers from the Contract library',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Groundwork for Settings → Flows. Nothing changes on screen yet.',
    'A step can wait on a paper made in the Contract library, called by the name the library gives it.',
    'A step finishes on either of its facts only when it is marked a fork.',
  ],
}

export default note
