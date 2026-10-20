import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5654',
  date: '2026-10-19',
  title: 'Bids: a count row can carry a kind, tags and a split of its price (the ground under the next Pricing release)',
  kind: 'feature',
  highlights: [
    'Nothing changes on screen yet. Each count row can now keep a kind (fixture, pipe, fitting, equipment or allowance), words of your own (tags), the material it sells at, a markup of its own and whether it is taxed.',
    'A copied bid version carries them with the rows.',
    'The next release draws them on the Pricing Workbench: each row’s price split into material, sales tax and labor, with breakdown cards by kind and by tag.',
  ],
}

export default note
