import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2114',
  date: '2026-08-22',
  title: 'Count rows remember their unit',
  kind: 'infra',
  highlights: [
    'Each count row can now carry its unit (each, feet, unscaled px, or sq ft) as data instead of only in its name — the groundwork for editing a row\'s unit and for per-foot labor and pricing.',
    'Existing takeoff rows copied from CountTooling ("ft of …") are stamped as feet; copying a bid keeps every row\'s unit.',
  ],
}

export default note
