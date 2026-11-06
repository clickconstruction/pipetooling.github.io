import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6581',
  date: '2026-11-06',
  title: 'The company’s checklist questions are written on the job’s Documents tab: the add box’s company pick, Use as the company’s list, a take-off with its reason, the company’s order, and Settings as a read-only mirror (punch list #237, PR 4)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a job’s Documents tab the add box asks where the check goes: This job, or Every Trim Set in the company. The company pick writes the question for every job of the kind, with the photo and signature asks, and the toast says so.',
    'Use as the company’s Trim Set list moves a job’s own checks onto the company’s list at once. It does what is ready, keeps this job’s answers, and names a check the company’s list already asks with the reason.',
    'The office takes a question off the company’s list with a reason, and moves the company’s questions with the same ▲ ▼ as the job’s own checks. Every answer already given keeps its words.',
    'Settings → Jobs & billing → Stage checklists is read-only now: each question with its asks and the job it came from or who wrote it, and the questions taken off with who, when and why. The card goes in a later release.',
  ],
}

export default note
