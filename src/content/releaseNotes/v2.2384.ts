import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2384',
  date: '2026-08-27',
  title: 'One price book, one door',
  kind: 'feature',
  highlights: [
    'The price book lives in one place now: click the book chip above the Workbench and the whole book slides in beside the table — the old ▶ Price book section at the page bottom (and its unused "This version’s prices" mode) are gone.',
    'The drawer shows just your book with a › to reveal the others — picking one switches the bid and becomes your default for new bids.',
    'Combined price ⇄ Stage price: one number per entry, or the Rough In / Top Out / Trim Set split. A price added in Combined lands in Rough In, so it’s never lost.',
    'Search, Add entry, Add book, and rename all ride in the drawer — the table stays on screen the whole time.',
  ],
}

export default note
