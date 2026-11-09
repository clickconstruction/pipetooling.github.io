import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6716',
  date: '2026-11-08',
  title: 'Legal desk: a text document on a matter is kept as text, read on the desk and the portal, and found by search',
  kind: 'feature',
  highlights: [
    'Drop a .md or .txt on Documents for the firm and the desk keeps its words as well as the file. The row gains Read, which draws the document under the row; the firm sees Read here on the same document on its portal.',
    'The dev seat files a text document with plan_matter_document and markdown instead of a file, and a .md or .txt filed off a mail is kept as text too. The plan names the text’s size and sections.',
    'search_case finds a line inside a matter’s text document and names the section it sits in, the way it does for a named document on an HR file. A PDF is still found by its title and what it shows.',
    'Under the hood the HR file’s named documents and a matter’s text documents now share one documents table, the owner’s pick between a column beside the file and the shared table.',
  ],
}

export default note
