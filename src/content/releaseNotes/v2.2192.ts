import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2192',
  date: '2026-08-23',
  title: 'Light mode: section lines you can actually see',
  kind: 'fix',
  highlights: [
    'The gray lines that outline cards, tables and sections were nearly invisible on white. They are now one step darker across the whole app, so light mode separates sections the way dark mode always has.',
    'Dark mode is unchanged.',
  ],
}

export default note
