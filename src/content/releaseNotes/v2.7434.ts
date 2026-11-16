import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7434',
  date: '2026-11-16',
  title: 'Lien desk: To send for Master approval, and Approved · to mail',
  kind: 'feature',
  highlights: [
    'To send is now To send for Master approval. It is the step where the office sends a paper to the master. It reads that way on the Board and on the By paper lists for monthly notices, lien affidavits and retainage notices.',
    'Awaiting approval is now Awaiting Master approval, in the same places.',
    'In the run is now Approved · to mail, and Ready to send is now Approved · to print on the Monthly notices list. On the Retainage notices list the approved pile reads Approved · to mail.',
    'The run keeps its name. On a list narrowed to one pile, the link on the pile’s title now reads every pile.',
  ],
}

export default note
