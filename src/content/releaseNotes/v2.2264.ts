import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2264',
  date: '2026-08-25',
  title: 'Roadmap stages go step-by-step',
  kind: 'feature',
  highlights: [
    'Tasks in a stage now run in their numbered order — 4.2 waits until 4.1 is done, and only the task that is actually next lands on someone\'s list.',
    'A new ⏳ Coming up section (Today tab and Dashboard) shows your waiting tasks grayed out, naming the task ahead and who\'s doing it.',
    'The moment the step ahead is completed, the next task appears on its assignee\'s list automatically.',
    'Stages that really are do-in-any-order checklists can be switched back: edit the stage → "Tasks run: Any order".',
  ],
}

export default note
