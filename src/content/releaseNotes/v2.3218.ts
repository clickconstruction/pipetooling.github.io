import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3218',
  date: '2026-09-10',
  title: 'Billing figures: the temporary double-check is retired',
  kind: 'fix',
  highlights: [
    'When every billing number moved onto one shared rule set in late August, each page kept computing its old figure alongside the new one for a week so any disagreement could be caught. That week is up and nothing fired, so the second computation is gone.',
    'Nothing changes on screen — the Dashboard, Pipeline strip, Quickfill, Customer Hub and Customers list keep showing the same totals, with a little less work behind each one.',
  ],
}

export default note
