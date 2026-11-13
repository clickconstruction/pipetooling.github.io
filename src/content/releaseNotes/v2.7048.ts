import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7048',
  date: '2026-11-12',
  title: 'Accounts Receivable: the lien chip names the next step in the Pipeline’s words',
  kind: 'fix',
  highlights: [
    'The lien chip under a bill in Accounts Receivable now names the step to take: Find the owner, Draft the notice, Send the notice, Draft the affidavit. It read Needs the owner, Notice to draft or Approved, ready to send.',
    'An affidavit held by one missing fact names the fact, like Answer the homestead question. It read fix the property.',
    'These are the same words the Pipeline’s billed row prints, so a job reads one way in both places. The chip keeps its own day and count.',
  ],
}

export default note
