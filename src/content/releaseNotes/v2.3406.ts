import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3406',
  date: '2026-09-14',
  title: 'Parts can say how they are sold: 20 ft sticks, 100 ft coils, by the box',
  kind: 'feature',
  highlights: [
    'Pipe comes in sticks, not by the foot. A Material Part Type now has a “Sold in” rule — Copper pipe · 20 ft sticks, PEX · 100 ft coils — and every part of that type follows it. Six entries cover the catalog.',
    'Add Part and Edit Part show the same “Sold in” pair, grey when it comes from the type; type a number to make one part different, such as a 10 ft stick. Blank means sold by the each.',
    'A takeoff line remembers the rule the day its part was picked, the way it remembers the price, so a later catalog change never re-costs a bid you already sent. The rounding itself — 105 ft needed buys 120 ft — arrives in the next release on the takeoff sheet.',
  ],
}

export default note
