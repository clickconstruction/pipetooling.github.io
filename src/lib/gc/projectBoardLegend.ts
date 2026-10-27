/**
 * What GC projects holds (punch list #187, PR 4): the card behind the ? beside New here?. The board,
 * its strip, a row's ring, the other views and the walk, one sentence each, and the door to the
 * board's guide. The walk stays; this card is its short version. Held by `deskLegends.test.ts`. Pure.
 */
import type { DeskLegend } from '../help/deskLegend'

export const PROJECT_BOARD_LEGEND: DeskLegend = {
  key: 'gc-projects',
  label: 'What this page holds',
  rows: [
    { key: 'board', label: 'The Project Board', accent: '#2563eb', note: 'Every GC project by its stage, with the days left and the price so far.' },
    { key: 'strip', label: 'The strip', note: 'One pill per stage with its count. A press on one jumps there.' },
    { key: 'ring', label: 'A row’s ring', accent: '#059669', note: 'Fills as the project gets through its stage. The card says what to do next.' },
    { key: 'by-customer', label: 'By customer', note: 'The same rows under each customer we build for.' },
    { key: 'views', label: 'The other views', note: 'Trade partners, Customers, Follow up, Messages and Money, one tab each.' },
    { key: 'walk', label: 'New here?', accent: '#d97706', note: 'A ten stop walk of the page. This card is the short version.' },
  ],
  guide: { slug: 'see-where-every-gc-project-stands', title: 'see where every GC project stands' },
}
