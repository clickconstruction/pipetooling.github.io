import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3769',
  date: '2026-09-23',
  title: 'A task sent from a job wears the job as a chip on every list',
  kind: 'feature',
  highlights: [
    'A task sent from a job used to read as a sentence — the job name underlined, a dash, then the task. Now the job is a chip in front of the task: the number in a badge, the name, and a small arrow that opens the job. The dash is gone.',
    'It shows everywhere a task title does: Checklist Today, Manage and History, the Dashboard inbox, the Dispatch and Estimator inboxes, and People → Review — including tasks sent before today.',
    'Tasks that are not about a job, vehicle tasks and pasted links look exactly as before. On a phone a long job name puts the chip on its own line with the task under it.',
  ],
}

export default note
