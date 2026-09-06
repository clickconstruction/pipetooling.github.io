import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2944',
  date: '2026-09-06',
  title: 'Subs and helpers can look up a job\'s address from the search icon',
  kind: 'feature',
  highlights: [
    'The search icon in the top strip now shows for subs and helpers. Type a job number, part of the name or part of the street and tap the job: a small card shows the number, name, address and trade, with Directions and Call office buttons.',
    'It is read only — it never clocks you in and never touches the job. The Clock In button is still the only way to start time; you no longer have to open it just to read an address and cancel.',
    'The field search finds jobs only. Bids, estimates, customers and the office\'s job window stay where they were.',
    'New guide for the field: "find a job\'s address from the field".',
  ],
}

export default note
