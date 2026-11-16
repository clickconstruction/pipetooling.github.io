import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7476',
  date: '2026-11-16',
  title: 'Lien desk: print every filed lien’s copies in one press, and enter their mail numbers in one place (punch list #366)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When two or more filed liens owe their copies, Record service on a To do row opens one window for all of them: Filed liens: copies to mail. It says how many, the soonest day, and how many are past their day.',
    'One press prints the stack. A mail sheet comes first and lists every envelope in order with a blank for its certified mail number. Then each envelope’s letter and copy. Each job keeps its own print.',
    'A lien that cannot print stays in the window with its reason and a door to its Lien window. The rest print.',
    'After the post office, type the day and scan or type each number in the same window. Enter moves to the next envelope. One press records every lien that is ticked Mailed, and a lien that did not record stays with its reason.',
  ],
}

export default note
