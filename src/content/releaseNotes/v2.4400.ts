import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4400',
  date: '2026-10-02',
  title: 'The page behind the Lien desk stays still on an iPhone',
  kind: 'fix',
  highlights: [
    'With Dispatch mode or Job mode on, some windows stop above the bottom bar. On an iPhone the page behind them could still scroll.',
    'This covered the Lien desk, Put a GC on notice, Bank payments, a person’s desk and the clocked-in map.',
    'A window now holds the page still because it is a window, whatever its size.',
  ],
}

export default note
