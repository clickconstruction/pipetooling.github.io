/**
 * What the Subs board holds (punch list #187, PR 4): the card behind the ? at the strip's end. The
 * two paragraphs the board printed under its strip since v2.5809 move here, one row a part, with the
 * door to the board's guide, so the screen is shorter and the words are read when asked for. Held by
 * `deskLegends.test.ts`. Pure.
 */
import type { DeskLegend } from '../help/deskLegend'

export const SUBS_BOARD_LEGEND: DeskLegend = {
  key: 'subs-board',
  label: 'What this board holds',
  rows: [
    { key: 'strip', label: 'The strip', accent: '#7c3aed', note: 'The path onto the bench. To call, Called, Talked, On the bench, Quoted.' },
    { key: 'moves', label: 'What moves a company', note: 'Didn’t Answer moves it to Called. Answered moves it to Talked. Add to the bench puts it on the bench. Its first quote moves it to Quoted.' },
    { key: 'for', label: 'For', note: 'The project a set of plans is for. Its trades come first.' },
    { key: 'column', label: 'A column', accent: '#2563eb', note: 'One trade. Call first on top, then who answers, then never called, then coldest.' },
    { key: 'top-3', label: 'Call the top 3', accent: '#059669', note: 'Runs the calling deck through the column’s best three in order.' },
    { key: 'card', label: 'A card', note: 'Call now, To the bench, Pass, and the pick between Call first, Normal and Later. A drag pins it.' },
  ],
  guide: { slug: 'find-subs-for-the-bench', title: 'find subs for the bench' },
}
