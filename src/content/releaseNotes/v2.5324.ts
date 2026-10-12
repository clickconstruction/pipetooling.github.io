import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5324',
  date: '2026-10-12',
  title: 'Messages: write down a day someone gave, and highlight words, in their thread',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Under a message with a day in it, say what the day is a promise of, or that it was just talk.',
    'A day written down shows under their name, and their move runs until that day.',
    'A plans question can go to the architect, or you can answer it yourself.',
    'Select words in a message and highlight them. The thread shows the highlight instead of the first lines.',
  ],
}

export default note
