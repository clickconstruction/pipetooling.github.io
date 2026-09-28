import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4109',
  date: '2026-09-28',
  title: 'My Time day editor: payroll hours follow a change to approved times',
  kind: 'fix',
  highlights: [
    'Moving the line between two approved sessions in the day editor — or any save that changed an approved session’s times in place — left the day’s payroll hours at the old total.',
    'After such a save the day’s payroll hours are now recounted from its approved sessions, the same way Adjust times already does.',
    'Assigning a job to part of a block recounts them the same way.',
  ],
}

export default note
