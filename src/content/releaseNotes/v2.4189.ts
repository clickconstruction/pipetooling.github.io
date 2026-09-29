import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4189',
  date: '2026-09-29',
  title: 'Submittals: See what the GC sees, beside the road, as you edit',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    '“See what the GC sees” on the strip opens the GC’s page for the rows as they stand — the same page your link opens — beside the road on a desktop, as a sheet on a phone. It follows every edit: fix a row and the pane changes with it.',
    'It is read-only and shares nothing; the line at the top says “The GC sees nothing until you share” or, after a share, “This is what the link shows now.”',
  ],
}

export default note
