import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4312',
  date: '2026-10-01',
  title: 'Edit Job → Bill: line item names read whole on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, each line item now has its name on a row of its own. Before, a name like Rough In broke into a few letters a line.',
    'The count, the price and the trash sit on a line under the name. The In order / Any time switch stays under them.',
    'On a touch screen the arrows, the boxes and the trash are big enough for a thumb. A discount line works the same way.',
  ],
}

export default note
