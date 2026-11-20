import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8006',
  date: '2026-11-19',
  title: 'Developments: a Schedule look says where every stage ahead stands',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A Development page has a new look, Schedule. It shows one card for each stage ahead on the site.',
    'Each card says where the stage stands in one sentence, with a coloured dot. The stages with trouble come first.',
    'A banner on top says how many answers the customer owes us, and how many days they have moved on the site.',
    'Rest on a stage’s ready bar to see what it still takes to start. Press the card to open its list.',
  ],
}

export default note
