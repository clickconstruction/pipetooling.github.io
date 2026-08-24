import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2208',
  date: '2026-08-23',
  title: 'Workbench batch 2: quieter solver line, editable prices',
  kind: 'feature',
  highlights: [
    'Every price card\'s ✎ opens a Price modal — rename it or delete it (the ★ price can\'t be deleted while the letter is built on it). Cards are wider so names and footers never squish.',
    'The solver line slimmed down: whole-dollar Revenue / Profit / Margin (centered), the rare "Price unpriced only" tucked behind a ▾ on Solve, and Apply / Discard ride the right end of the same line with "nothing saved yet" beneath.',
    'Unpriced bids skip the status band and open straight on the solver, with ＋ Add price at the line\'s end. The progress line now just reads "1 of 1 priced".',
  ],
}

export default note
