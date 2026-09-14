import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3426',
  date: '2026-09-14',
  title: 'PO code: the job account status sits under the supply house pick',
  kind: 'feature',
  highlights: [
    'Materials → PO Generator and Dispatch Mode → PO: once the job and the supply house are picked, a line says whether the job has an account there — amber “No job account at Ferguson for 964 yet. Ferguson expects one per property. Curly Conley opens them: 210-344-4950.” or teal “Ferguson job account open · ref JA-4114 · Sep 2 · by phone”.',
    'The amber line carries Call Curly, Mark opened… (two taps after the call), Send the packet, and Not needed for this job. The code still mints either way — the tech is standing at the counter.',
    'A tech’s open ask shows here too (“asked Sep 14 from the counter — not open yet”), so minting the code and closing the errand happen in one place.',
  ],
}

export default note
