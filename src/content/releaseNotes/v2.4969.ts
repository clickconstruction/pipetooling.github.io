import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4969',
  date: '2026-10-08',
  title: 'Lien desk: the claim is what is billed, and the bills are listed under it',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'A notice now claims what the job’s sent bills still owe, never the job’s whole price. A job billed in stages no longer claims the stage not yet billed, so the claim and the pay page behind it always agree.',
    'The Months card lists the bills behind the claim: each sent bill with what was billed, paid and still owed, then the part of the job not billed yet.',
    'Bill it from here › on that line opens Bill Customer over the desk. When the bill goes, the desk re-reads and the claim fills in by itself.',
    'A job with money on it but nothing owed on its sent bills gets a fifth gate, Nothing billed, that holds the send until the work is billed.',
  ],
}

export default note
