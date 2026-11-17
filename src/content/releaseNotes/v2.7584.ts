import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7584',
  date: '2026-11-17',
  title: 'Tasks: an assistant can give a task the way the New task window does',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now give someone a Checklist task: who it is for, the words, the day or a repeat, a due day, the Done when… lines, a reminder and a place.',
    'It runs the same rules as the New task window, so the task lands exactly as one given in the app. It shows what would land first and writes only after that is read.',
    'It can also find tasks by their words or their person, and read one task whole.',
    'Nothing changes on the New task window itself, and nobody is sent a push when a task is given, as before.',
  ],
}

export default note
