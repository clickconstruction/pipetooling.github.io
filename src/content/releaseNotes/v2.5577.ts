import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5577',
  date: '2026-10-16',
  title: 'Settings → Training previews a course and can clear a retake day; the Users row wears a cap for training',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Settings → Training has Preview the course beside each course, which opens it as a dev sees it, on or off.',
    'Once Everyone takes it again is pressed, the day shows as an amber chip with a Clear. Clear puts the old passes back to counting.',
    'The content hash left the facts line. It stays on every pass record.',
    'On People → Users, the Paper cell draws a cap when the row’s lead need is a course, so training reads at a glance beside the papers.',
  ],
}

export default note
