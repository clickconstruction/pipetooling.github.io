import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6278',
  date: '2026-11-01',
  title: 'The law firm adds a person with their rule on the same card',
  kind: 'feature',
  highlights: [
    'On the firm portal\'s Notifications tab, the Add a person card now carries the two rules, Emails and Matters, with the digest\'s day and time, so a person is added with the rule they keep. The card is the row it becomes.',
    'Role is now Title, a word the firm types, with a line saying it shows beside the name on the portal and to the office. The old pick of paralegal, attorney and billing read as if each opened a different door, and none did.',
    'Only theirs shows a count under it: how many open matters the office names that person as handling today. A zero says they would hear nothing yet.',
    'The two paragraphs that explained the tab are gone. What they said is on the rows, the presses and the count. The press names the person: Send Ann a confirmation.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
