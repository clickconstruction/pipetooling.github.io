import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4366',
  date: '2026-10-02',
  title: 'Submittals: the walkthrough knows about parts',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Walk me through it on Submittals now explains parts: each row lists its parts, and each part has its own house, lead time and stage in Edit.',
    'A new stop shows the blue box on a draft whose takeoff has changed, with Refresh from the takeoff and Make it a part. It only appears when the box is there.',
    'The cut sheets stop mentions Read its parts. Their answer and Resubmit say the GC answers each part. Procure explains one line per part, To order, marking lines ordered, and tapping a line to change its house.',
  ],
}

export default note
