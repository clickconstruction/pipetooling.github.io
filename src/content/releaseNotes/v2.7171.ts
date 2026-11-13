import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7171',
  date: '2026-11-13',
  title: 'Lien desk Share: a job with no GC no longer prints a blank name',
  kind: 'fix',
  highlights: [
    'When a notice job had no GC set, Share left the name empty. The message read “• , 1 job, $3,553” under By GC, and the waiting line had two commas with nothing between them.',
    'The message and the email now say “No GC on the job” in that place, the same words the desk’s own check uses.',
  ],
}

export default note
