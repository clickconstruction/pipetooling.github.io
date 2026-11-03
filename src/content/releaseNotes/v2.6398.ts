import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6398',
  date: '2026-11-02',
  title: 'Send a homeowner the warranty in place of a contract',
  kind: 'feature',
  highlights: [
    'The Contract window has a Paper pick: Contract or Warranty. Pick Warranty when a contract would put a homeowner off. The paper keeps the work and the price, the warranty’s terms, and four lines the customer initials that you can rewrite per job. The three ways to get it signed are the same: a link by email or text, Sign here now on your phone, or on paper.',
    'On the signing page the customer types initials beside each line, two to four letters, then signs. The page refuses the signature until every line is initialled and says which one is blank. The signed PDF prints the initials in their boxes, and the signed copy goes to the customer as a contract’s does.',
    'The Pipeline’s contract chip reads Warranty sent and Warranty signed, so the amber No contract nag goes quiet once a warranty is on file. The job’s activity says Warranty where it said Contract, and the customer’s thread gets a line when the paper goes and when it is signed, for a contract too.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
