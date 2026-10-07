import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4826',
  date: '2026-10-07',
  title: 'Lien desk: the § Rules window answers the question you came with',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Every rule is now named by the question it answers, with a one-line answer under it. The rules fold to that line, and only the rule for your screen opens. Press a question to unfold it.',
    'A list on the left jumps to any rule, a row of chips on a phone. When the desk has a job picked, the window names it with its notice date and its lien date, and the dates table lights that job’s month.',
    'A new rule, How soon the lien can be filed, says it plainly: the 15th dates are the last day, not the first. File as soon as the work is done and the steps are taken.',
    'A rule counsel has not read yet says so in an amber line. Each rule’s What you do names the screen and opens it.',
  ],
}

export default note
