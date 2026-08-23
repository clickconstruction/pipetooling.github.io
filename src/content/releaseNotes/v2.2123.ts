import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2123',
  date: '2026-08-23',
  title: 'Split hygiene: clones keep their name, unpriced scenarios can\'t be starred',
  kind: 'fix',
  highlights: [
    'When a new bid (version) starts its prices from a scenario, the copy keeps that scenario\'s name — WENDI stays WENDI — instead of being renamed after the new bid. The split modal says so.',
    'A scenario with no prices yet no longer offers "☆ Make customer-facing…" — price it (or copy prices from another scenario) first.',
    'A new bid\'s ★ is the scenario it started from, right away.',
  ],
}

export default note
