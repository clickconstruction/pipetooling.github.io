import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8636',
  date: '2026-11-26',
  title: 'Pricing: a price typed on a sent bid no longer stays in the field as if it saved',
  kind: 'fix',
  highlights: [
    'A sent bid’s prices are locked until you press Revise. A price typed there was refused, as it should be, but the typed number stayed in the field until a reload.',
    'Now the field goes back to the saved price the moment the note says the bid was sent. Revenue, Profit and Margin on the row do the same.',
    'Nothing else about the lock changes: press Revise on the Pricing header to change a sent bid’s prices.',
  ],
}

export default note
