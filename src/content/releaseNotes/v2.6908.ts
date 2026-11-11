import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6908',
  date: '2026-11-10',
  title: 'Drop a supply house’s quote on Takeoffs and it reads itself',
  kind: 'feature',
  highlights: [
    'Takeoffs has a new press, Price sheet. You can also drop a quote’s PDF anywhere on the tab, or paste its rows. The sheet opens beside the takeoff, fixture by fixture.',
    'It names the supply house and why, and asks when it is not sure. It opens on the rows that need you and folds the rest.',
    'Every press saves itself. Fold the sheet any time. A chip in the title row opens it again where you left it.',
    'A PDF that is a picture of a sheet cannot be read yet. Paste its rows as text for now.',
  ],
}

export default note
