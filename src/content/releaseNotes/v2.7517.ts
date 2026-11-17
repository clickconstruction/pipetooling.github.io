import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7517',
  date: '2026-11-16',
  title: 'Lien desk: the run holds a notice whose paper and bills no longer agree',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A notice keeps the claim it was drafted with, while the pay codes page and the invoices read the bills as they are today. A bill corrected after the draft left one packet stating two amounts. The run now compares the two before it prints.',
    'When they differ, the run holds that notice and says both figures, like The paper claims $18,400.00. The bills now come to $6,150.00, $12,250.00 less. No page of it prints, in the packet or one copy at a time, and it does not go to Docsmit.',
    'The rest of the run prints and records as usual. Retainage typed on the job after the draft, and a claim set by hand since, hold the notice the same way.',
    'A notice that already printed is not held, so the record of a paper that went out is never stopped.',
  ],
}

export default note
