import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7493',
  date: '2026-11-16',
  title: 'Lien desk: By job can group its rows by property',
  kind: 'feature',
  highlights: [
    'By job has a new picker, Group, beside GC and Show. Pick By property and the rows gather under a head for each property that holds more than one job.',
    'A head names the address and the owner, then counts the whole property, like 7 jobs · $15,870 open · 4 notices sent Oct 14 · 2 on Sep 22 · 1 to print and mail · 6 lien affidavits ready to file. Press the address to open the property card.',
    'The properties with one job follow under One job each, and a job with no property record under No property record.',
    'A head always counts the whole property, notices and liens apart. When GC or Show hides some of its jobs, the head says how many are shown. Pick a GC first to see what that contractor has at each property.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
