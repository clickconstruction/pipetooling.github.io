import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6610',
  date: '2026-11-07',
  title: "Edit a person's HR summary or narrative in People → HR",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The Summary and Narrative headings on a person\'s HR file now carry an Edit press. The text opens in a box, in markdown, with a line that says what Save will do and a fold that shows how it will read.',
    'Save is refused when someone saved the document after you opened it, the agent from its seat included, and the words tell you the way out. The prior version stays in the file\'s history.',
    'A file with no summary yet offers Write instead. The help guide for private employee files has the steps.',
  ],
}

export default note
