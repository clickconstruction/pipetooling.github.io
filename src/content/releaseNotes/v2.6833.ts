import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6833',
  date: '2026-11-10',
  title: 'Permits: a street view and a map on every skim card, and a swipe to answer',
  kind: 'feature',
  highlights: [
    'Each card on Skim now opens with two pictures: a street view of the address, with the month it was taken, and a map with the permit in its middle and the miles from the office.',
    'Where there is no street view the first picture is satellite, and says so. A press on either picture opens it in Google in a new tab.',
    'On a phone, drag the card: right keeps and left passes. The word shows as the card passes a third of its width, and a short drag springs back. The two buttons stay as they were.',
  ],
}

export default note
