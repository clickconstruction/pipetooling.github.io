import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7750',
  date: '2026-11-18',
  title: 'Pipeline: the Back to Edit Job banner is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the blue Back to Edit Job banner on the Pipeline lives in its own file, with the rules for when it shows.',
    'Nothing changes on screen. The banner still shows for ten seconds after See in Stages, and Back to Edit Job still opens the job.',
    'New tests cover when the banner shows, how it goes away, and what Back opens.',
  ],
}

export default note
