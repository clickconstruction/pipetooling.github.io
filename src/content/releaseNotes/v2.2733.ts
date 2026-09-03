import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2733',
  date: '2026-09-03',
  title: 'Wheels: what each person’s vehicle costs per field hour',
  kind: 'feature',
  highlights: [
    'Pay config gains a Vehicle deal per person: own vehicle with fuel paid, company truck, or none. It records which deal someone is on; Review starts pricing by it in the next release.',
    'People → Vehicles → 🛞 Wheels shows the last 90 days per person: fuel-tag charges attributed to them, approved field hours, fuel per field hour, and the rate their deal implies — with a manual override.',
    'Company trucks get a running-cost table: the holder’s fuel, insurance and registration pro-rated over the window, service, and the all-in rate per holder field hour, so the two deals can be compared side by side.',
  ],
}

export default note
