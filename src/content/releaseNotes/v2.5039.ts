import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5039',
  date: '2026-10-09',
  title: 'Bids and Crew P&L: what the trucks cost per field hour, wear included',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Bids → Labor: the Crew rate card now shows what the company’s trucks cost per field hour. It is shown and never added, because the burden and the driving line already carry the truck.',
    'Jobs → Crew P&L has a Vehicle column. Each person’s vehicle deal is charged as Review charges it: the fixed rate times their field hours in the range, and profit takes it off.',
    'A company truck’s fixed rate now includes wear, its latest replacement value spread over five years. People → Vehicles → Wheels shows each truck’s wear, and says so when no value is on file.',
    'The $50 sub rate on Crew P&L stays as it is. Working it out from the crew’s real pay waits until the vehicle records are in.',
  ],
}

export default note
