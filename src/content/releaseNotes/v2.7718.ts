import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7718',
  date: '2026-11-17',
  title: 'Edit Job: the rule for Delete or Reassign is its own tested piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Job form had grown large again. Its map is drawn again at today\'s size, with ten cuts in order of safety.',
    'The first cut is in. A job with costs on it must be reassigned before it can be deleted, and that rule now has its own tests.',
    'So does the rule for which labor line on the Costs tab opens on Jobs.',
    'Nothing changes on screen.',
  ],
}

export default note
