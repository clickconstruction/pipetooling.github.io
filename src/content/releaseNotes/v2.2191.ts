import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2191',
  date: '2026-08-23',
  title: 'Supply Houses reads on a phone',
  kind: 'fix',
  highlights: [
    'On a phone the aging table becomes one row per house: name, the worst news ("$13,184 at 90+" in red, or "most in 1–30"), a five-color aging bar, and the total. Tap a house to open it. Desktop and tablet keep the full table.',
    'The Quickfill section now reports a real count — houses with anything 60+ days past due — instead of "—", and the intro line says "N houses 60+ past due" on every screen.',
  ],
}

export default note
