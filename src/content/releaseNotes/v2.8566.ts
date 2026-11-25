import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8566',
  date: '2026-11-24',
  title: 'Accounts Receivable: the developer can reopen a closed test case',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'In the list of Accounts Receivable, the developer now reads Closed test cases, folded behind Show. Nobody else sees it.',
    'It lists closed cases on ZZ test jobs only, each with Reopen…. Closed cases on real jobs are counted and never listed.',
    'Reopen puts a case closed as settled another way or as not coming back under Came back. A case closed any other way stays, and its line says why.',
    'The window that asks first has a button that reads Reopen the case.',
  ],
}

export default note
