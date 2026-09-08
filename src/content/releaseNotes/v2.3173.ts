import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3173',
  date: '2026-09-08',
  title: 'Supply houses know their trades',
  kind: 'feature',
  highlights: [
    'A supply house can now say which trades it serves — Plumbing, Electrical, HVAC — on its form. Leave them all off and it shows for everyone.',
    'The Supply houses directory has trade chips beside the search. An estimator limited to one trade starts on that trade and sees only the houses that serve it, plus any house nobody has tagged yet.',
    'Send price requests starts with the houses that serve the bid\'s trade and says how many it hid — "show all" brings the rest back.',
  ],
}

export default note
