import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6601',
  date: '2026-11-06',
  title: 'The Tasks folder in Drive, and a card that asks for a photo at the finish',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Documents → Where files go gets a fifth card, The Tasks folder. Make the Tasks folder has the app make PipeTooling Tasks beside the Jobs folder in its Shared Drive; or paste a folder from any Drive the app can write in.',
    'Every photo taken on a task card will file under it, in a folder per card named by the day and the title, a roadmap card’s under its roadmap and stage, named 2026-11-04 Mateo · 67%.jpg, finish.jpg, or by the line it proves. The photo sweep files them a few minutes after the shot.',
    'The ＋ Task dialog, Manage → Edit and the Roadmap’s Add task carry Asks for a photo at the finish. It turns on by itself when Done when… lines are written and stays off on a plain one-off. The photo itself arrives with the next change.',
  ],
}

export default note
