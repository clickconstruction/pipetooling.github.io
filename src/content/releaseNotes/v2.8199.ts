import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8199',
  date: '2026-11-21',
  title: 'Punch list: tick the cards you are working on',
  kind: 'feature',
  highlights: [
    'Every card on the Punch list has a checkbox beside its number. Tick it when you are working on that card.',
    'A tick is yours alone, and it is kept with your account. It is there after a reload, on your phone and at your desk.',
    'A card that moves to another section, such as Ready to build to Close out, loses its tick. So does a card that leaves the list.',
    'Working on, beside the filters, counts your ticks and shows only those cards.',
  ],
}

export default note
