import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5850',
  date: '2026-10-25',
  title: 'Legal desk: one menu per document, and a day’s burst of documents folds on the Timeline',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Each row under Documents for the firm trades its four buttons for one ⋯ menu: Hold from the firm, Mark sent, Mark final, Received, Not sent after all, Remove. The hold reason still opens in place.',
    'Four or more documents added on one day fold into one Timeline row, such as “6 documents added to Evidence”, with Show each. A paper with its own day stays where it belongs.',
  ],
}

export default note
