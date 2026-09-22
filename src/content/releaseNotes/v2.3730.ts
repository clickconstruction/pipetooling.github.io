import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3730',
  date: '2026-09-22',
  title: 'Dev MCP writes: one apply per plan',
  kind: 'fix',
  highlights: [
    'The live check of the new write verbs found that a plan with nothing to compare against beforehand — a thread note, an HR entry — could be applied twice with the same fingerprint, landing the same note twice. Apply now refuses a plan that has already been applied, naming the earlier batch and when; a cost batch that was since reverted does not count, so a wrong batch can be reverted and the same plan applied again on purpose.',
    'The plan reply says so: one apply per plan.',
  ],
}

export default note
