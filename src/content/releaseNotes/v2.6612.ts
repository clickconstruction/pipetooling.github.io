import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6612',
  date: '2026-11-07',
  title: "The HR file's documents are easier to find and to edit",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "The view that holds a person's summary and narrative is now named Summary & narrative, and the HR tab's banner says the two documents can be edited here as well as by the agent.",
    'The press beside each document now reads Edit the summary or Edit the narrative, as an outline press, and the amber line on a stale summary names that press beside its ask to the agent.',
    "On the People list, a dev's ⋯ menu on any person has Open their HR file, the same door the Person Desk already had.",
  ],
}

export default note
