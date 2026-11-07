import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6619',
  date: '2026-11-07',
  title: "One page on a person's case, for the agent that reads it first",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The dev seat can now ask for one page on a person's case: the agent's own notes first, the summary, the sections of the narrative and of every named document, the newest entries, the evidence, the matter's steps and papers, the themes, and the developments the person worked on with their latest history lines.",
    'Every item comes with its id, so the next read goes straight to it. The text of a long document never travels whole; its section list does.',
    "A named document titled Agent notes is the place for an agent's running notes between sessions. The brief returns it first when it exists.",
  ],
}

export default note
