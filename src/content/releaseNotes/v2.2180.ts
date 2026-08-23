import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2180',
  date: '2026-08-23',
  title: 'Vehicles: set a vehicle\'s insurance cost right on its Insurance card',
  kind: 'feature',
  highlights: [
    'Open a vehicle and the new Insurance card sits under the odometer card: which plan it\'s on and since when (Change plan / Take off / Add to plan right there), and the cost — shown per week, month and year at once.',
    'Type the cost the way the carrier quotes it: pick / wk, / mo or / yr next to the box; the app stores it weekly (what pay stubs and the fleet total already use) and previews the conversion as you type.',
    'The Insurance plans list shows each vehicle\'s cost (amber "no cost set" when missing) and a Plan total per week / month / year to hold against the carrier\'s bill. A vehicle off a plan counts $0 until it\'s back on; its last cost is remembered.',
    'The cost box leaves the Edit form (registration stays there), and the action row\'s "Insurance" button folds into the card.',
  ],
}

export default note
