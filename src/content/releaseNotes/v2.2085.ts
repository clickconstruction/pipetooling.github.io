import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2085',
  date: '2026-08-22',
  kind: 'feature',
  title: 'Learn from your bid tabs: why we lose on price',
  highlights: [
    'A new panel on Why we lost turns recorded bid tabs into answers: "when we lose on price, we\'re typically X% over the low," how far off the misses run, where we usually land on the tab, and whether the pencil is sharpening quarter over quarter.',
    'A per-GC table sorted closest-first — the top rows are GCs where a small price move flips outcomes; the bottom rows are a costing question, not a discount question.',
    'The Pricing Workbench\'s "This number vs your history" strip now shows amber ▽ marks — the margin that would have matched each recorded tab\'s low — and counts your odds: "this number would have matched or beaten the low on 7 of 18 recorded tabs," with a GC-specific range when their tabs are on file.',
    'Everything scopes with the lens\'s "bids by" estimator select and a time-range pick; it all sharpens automatically as more tabs get recorded.',
  ],
}

export default note
