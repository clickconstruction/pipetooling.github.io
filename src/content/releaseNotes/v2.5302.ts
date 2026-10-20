import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5302',
  date: '2026-10-12',
  title: 'The daily log lists the trades’ claims to check before bill day',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On the checking days before bill day, the daily log lists each claim of the draws waiting on us, in walking order.',
    'Tap the percent you see, or whether stored material is on site. A tap under the claim asks for a photo link or a note.',
    'The list shows percents and photos only, never a dollar. The office approves in the Draws window.',
  ],
}

export default note
