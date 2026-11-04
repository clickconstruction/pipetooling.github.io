import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6500',
  date: '2026-11-04',
  title: 'Waiting on them clears when they accept the estimate, when you log their call, or when you press Heard back',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A customer who accepted or declined the estimate from our link no longer sits in Waiting on them: their answer on the estimate counts as their word. Opening the link alone does not.',
    'A call you logged from the thread with what they said clears the row too.',
    'Every row has Heard back ▾: By phone, By text from my phone, In person or No answer needed. The row clears at once, Undo stands on the toast for ten seconds, and then a gray line lands on their thread, such as “Taunya heard back by phone on Nov 3.”',
    'The lane’s ? card and the Messages guide say the new ways a row clears.',
  ],
}

export default note
