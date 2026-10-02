import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4337',
  date: '2026-10-01',
  title: 'Release of Lien: click a folded step to look at it again',
  kind: 'feature',
  highlights: [
    'Once the leader has the waiver to sign, or has signed it, the steps above fold to one line each. Click a folded step, or its number on the left, and it opens where it is so you can check it before you send.',
    'An opened step is read only, and the page on the right marks the part it filled in: the amount, the form’s title, the project line or the signature.',
    'Each opened step says how to change it: cancel the request first while he has it to sign, or void the signed waiver and make a new one. Click Fold to close it again.',
  ],
}

export default note
