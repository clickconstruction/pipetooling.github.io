import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2911',
  date: '2026-09-05',
  title: 'Supply-house replies match slashes and plurals; the RFQ menu has a name; change orders say which button leaves a record',
  kind: 'fix',
  highlights: [
    'Plug in a quote: a fixture named "Shower/tub combos" now matches a vendor who types "shower tub combo", and "Kitchen sink" matches "Kitchen sinks" — for pasted replies and dropped spreadsheets alike.',
    'On Bids → Pricing the bare ▾ beside Share now reads "Supply house prices (RFQ) ▾", and the menu item is "Supply house prices" — the quote-link lane is findable without hovering. A supply house opening a link you already closed no longer lights "Viewed" on the desk.',
    'Bids → Change Order: each button says whether it leaves a record — Copy and Google Docs are paper only; Send for signature creates the tracked change order. As you type Impact on Cost, a line reads the net change back to you, and the draft in Estimates shows your typed cost text above "Impact on cost".',
    'Estimates: a draft carrying only a due date, an address, or notes no longer counts as "empty"; the one old estimate titled "change order" wears a tag saying it is an estimate, not a tracked change order.',
  ],
}

export default note
