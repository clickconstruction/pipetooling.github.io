import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2688',
  date: '2026-09-03',
  title: 'Review: one hour basis for every per-hour number, and periods on the company calendar',
  kind: 'fix',
  highlights: [
    'Every "/hr" on People → Review now divides by the same thing — the person’s hours in the period (clocked, or 8 h per weekday for salaried people). The Jobs Worked footer says so, and still shows the hours-on-jobs figure on its own line.',
    '"Only count jobs marked Paid in Full" now changes which jobs earn revenue and nothing else — hours, field hours, and the parts burden stay on the same basis as the unfiltered view. The Hours drilldown reports hours on paid jobs separately.',
    'Period presets (This week, Last 30 days, This year…) are anchored on the company calendar day, the same day the 90-day overhead window uses, so a viewer in another time zone never sees the two a day apart.',
  ],
}

export default note
