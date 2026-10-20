import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5687',
  date: '2026-10-20',
  title: 'Pricing: price a fresh version from the book, right in the Workbench',
  kind: 'feature',
  roles: ['estimator', 'assistant', 'master_technician', 'dev'],
  highlights: [
    'A version with no prices yet — a side-by-side rebid with its own counts, say — now starts right where you stand: the panel offers Price from the book, and the Workbench opens on that version\'s own counts with Fill from book and the solver ready.',
    'The book offered is the one the version\'s sibling prices from, so a rebid prices apples to apples; another book ▸ opens the price book drawer to pick a different one.',
    'The copy door stays and says exactly what it does: copies follow fixture names, and rows only in your version stay unpriced. On a two-version packet the panel and the copy now name the versions instead of the GC twice.',
    'The panel\'s old advice pointed at the Old view, which retired in September 2026 — that dead end is gone, and the guides no longer describe the Old / New pills.',
  ],
}

export default note
