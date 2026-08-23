import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2198',
  date: '2026-08-23',
  title: 'Pricing header: CSV, Print and Review fold into the Share button',
  kind: 'feature',
  highlights: [
    'One control instead of four buttons: Share keeps its one-click green self, and the small ▾ beside it opens Print, Download CSV, and "Print all prices — review".',
    'Everything works exactly as before underneath — the ★ chooser, the disabled states, the role gate (users who can\'t Share see a single "Export ▾" over the same menu).',
    'On phones the header no longer wraps a row of buttons under the bid name.',
  ],
}

export default note
