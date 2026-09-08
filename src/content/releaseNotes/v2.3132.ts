import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3132',
  date: '2026-09-08',
  title: 'GC portal: the stages as one simple sequence, in the company\'s voice',
  kind: 'feature',
  highlights: [
    'The GC\'s portal now shows "Where the job is" — Stage 2 of 4 · Top-out · on site now — with a check on what has passed, the live stage and how far along it is in plain words, and what comes next. Only the stages whose eye is on.',
    'No sub\'s name and no "offered to a sub" ever appear; the GC sees our crew. Change orders you share sit under "Also on this job".',
    'Only the next stage carries "Need other dates?"; asks on any other stage are refused. The sample GC portal under Settings → What customers see shows the new card.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
