import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2415',
  date: '2026-08-28',
  title: 'Turning a bid into a job asks which GC gave it',
  kind: 'feature',
  highlights: [
    'Importing a multi-GC bid into New Job now asks "Which GC gave you this job?" — the job takes the winning GC as its GC/Builder instead of always the bid\'s own.',
    'Picking a GC records their Won on the bid (other sent, unanswered GCs are marked lost automatically), so the board and the job agree without a second trip.',
    'A bid with one recorded winner imports silently from that GC\'s packet; a single-GC bid works exactly as before.',
  ],
}

export default note
