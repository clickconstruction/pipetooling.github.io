import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2735',
  date: '2026-09-03',
  title: 'Review prices each person’s vehicle deal per field hour',
  kind: 'feature',
  highlights: [
    'People → Review now charges the vehicle deal set on Pay config: an own-vehicle person carries their fuel per field hour as part of their labor, a company-truck person carries the truck all-in (fuel, insurance, registration, service) per field hour. Their fuel no longer lands on co-workers by labor share.',
    'The math drawer shows the line — 🚗 Own-vehicle fuel or 🚚 the truck by name — with the hours and rate behind it; the verdict bar gains Company trucks and Own-vehicle fuel segments; every ranked bar carries a chip with the deal and its rate.',
    'People with no deal are unchanged, and Jobs → Job Summary still shows fuel as cash.',
  ],
}

export default note
