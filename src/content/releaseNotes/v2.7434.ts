import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7434',
  date: '2026-11-16',
  title: 'Lien desk: To send for approval, and Approved · to mail',
  kind: 'feature',
  highlights: [
    'To send is now To send for approval. It is the step where the office sends a paper to the leader. It reads that way on the Board and on the By paper lists for monthly notices, lien affidavits and retainage notices.',
    'In the run is now Approved · to mail. It is the step where an approved notice waits to be mailed. It reads that way on the Board and on the Monthly notices list.',
    'Ready to send is now Approved · to print on the Monthly notices list. It holds a notice that is approved and waits for the run to print it. On the Retainage notices list the same pile reads Approved · to mail.',
    'The run keeps its name. The run window, the tile that counts what is in the run and lines like it goes in the run read as they did.',
  ],
}

export default note
