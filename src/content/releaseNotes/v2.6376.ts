import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6376',
  date: '2026-11-02',
  title: 'Lien desk: a sent notice keeps the job’s GC on its gates',
  kind: 'fix',
  highlights: [
    'A notice in the Sent pile whose job has dropped off the due-months count, because every window has closed, nothing is billed yet, or the job is paid, read as if the job had no GC: gate 2 was red with Set the GC, while Edit Job showed the GC plainly. The desk now reads the GC and the customer from the job itself whenever the count has no month for it, so the gate is green and names the GC as the job does.',
    'The same fix reaches Put a GC on notice, whose entries read the GC the same way.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
