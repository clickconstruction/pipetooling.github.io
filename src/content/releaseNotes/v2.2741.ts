import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2741',
  date: '2026-09-04',
  kind: 'feature',
  title: 'A signed bid links itself to the job',
  highlights: [
    'Create a job from a signed bid-room proposal (or link the proposal to an existing job) and the job is tied to the bid automatically — the Stages contract chip shows the GC\'s signature and Edit job shows the bid.',
    'Bid Board → Links: a green J#### chip opens the job made from the bid. Visible to assistants, masters, controllers and devs.',
  ],
}

export default note
