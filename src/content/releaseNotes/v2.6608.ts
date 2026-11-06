import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6608',
  date: '2026-11-07',
  title: "A dev's agent edits a person's HR summary or narrative a section at a time",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The dev seat can now change a person's HR summary or narrative: the whole text, or one section at a time by its heading, with a plan that shows the words removed and added before anything is saved.",
    'A plan commits to the version it read. If anyone saves the document in between, the apply is refused and the agent plans again from the fresh text, so two writers never write over each other.',
    'Every save keeps the prior version, as before. The editor in People → HR that saves through the same door is the next change.',
  ],
}

export default note
