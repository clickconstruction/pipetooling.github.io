import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4028',
  date: '2026-09-28',
  title: 'Takeoffs and Materials: the lowest price is picked from every price on file',
  kind: 'fix',
  highlights: [
    'On a takeoff, the lowest catalog price of a part is now picked from every price on file. When the parts on a bid held more than 1,000 prices between them, the app read only the first 1,000, so a part could show a price that was not its lowest, or "No catalog price" when it had one.',
    'Materials → Parts Book reads the prices of a long parts list the same complete way, so a part cannot be missing a supply house it has a price at.',
    'The assembly bundle breakdown adds up every part at every supply house, so a large assembly cannot show a supply house total that is too low.',
    'No price was lost or changed. The prices were only being read short.',
  ],
}

export default note
