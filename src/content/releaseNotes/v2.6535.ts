import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6535',
  date: '2026-11-05',
  title: 'A thread’s ⋯ menu says Reach them by text, by email or either way, with the one that stands ticked',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The three rows that record how a customer wants to hear from us now read “Reach them by text”, “Reach them by email” and “Reach them either way”, in place of “Hears from us by …”.',
    'The row that stands wears a tick, and “Reach them either way” wears it until someone picks a way, so the menu always shows the current state.',
    'The toast after a pick reads “We reach Priya by email.”',
  ],
}

export default note
