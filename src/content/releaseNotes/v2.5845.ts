import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5845',
  date: '2026-10-25',
  title: 'Quickfill: the round ends on a close sheet, and the Dashboard shows the office’s round',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When the round is done, Quickfill no longer says only Round done. It says what is clean, what was worked and is still open, and what was handed up as a question, each a door back into its station.',
    'The Dashboard has a new card under Needs you, The office’s round. It reads Today 9:51 AM · Dana · 23 stations · 8 still open · 2 questions, with the questions and the open stations as doors. Before the round it reads No round yet today with yesterday’s shape. The morning after a missed day it reads No round Thursday in red.',
    'Nothing new is written. The day’s marks, with what each press meant, are the record.',
  ],
}

export default note
