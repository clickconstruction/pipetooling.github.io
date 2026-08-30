import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2507',
  date: '2026-08-30',
  title: 'Fittings for free — tees, wyes, and elbows derived from the traced pipes',
  kind: 'feature',
  highlights: [
    'Every joint now falls out of the traced geometry: 90° turns become elbows, 45° turns become 45-ells, branches become tees or wyes — no extra takeoff work.',
    'Derived fittings materialize as visible counters on the plans ("CW · Tee"), so the reviewer sees every joint; odd angles are flagged on the sheet, never silently binned.',
    'Ran live on the twin\'s LIVSTE takeoff: 20 fittings landed alongside the 27 fixtures and 14 runs.',
  ],
}

export default note
