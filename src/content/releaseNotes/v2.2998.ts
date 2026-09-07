import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2998',
  date: '2026-09-07',
  title: 'Takeoffs: switching views keeps the fixture you are on',
  kind: 'feature',
  highlights: [
    'Hop between Old, One at a time and Sheet — with the pills or the Sheet view / One at a time buttons — and you land on the same fixture: One at a time opens on it, and the sheet scrolls to it and flashes the row.',
    'The fixture is the last row you clicked or edited in any view (or the one One at a time was focused on). If you touched nothing, it is the row at the top of your screen when you hop.',
    'Reopening a bid on Takeoffs later in the session lands on that fixture too. One at a time now shows the same strip as the sheet (Bundles and Overrides included), so the top of the card does not change when you hop.',
  ],
}

export default note
