import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8540',
  date: '2026-11-24',
  title: 'Bills sent: a dev who shows ZZ test jobs can say how a test bill went',
  kind: 'fix',
  highlights: [
    'A test bill with no send on record is still out of the yellow box, and still in no total.',
    'A developer who shows ZZ test jobs on the Pipeline now sees those bills in a box of their own, under the yellow box.',
    'Each row there has Say how it went…, so the form can be tried on a test bill and never on a customer’s.',
    'Nobody else sees the box. A developer who hides ZZ test jobs does not see it either.',
  ],
}

export default note
