import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6693',
  date: '2026-11-08',
  title: 'Archive a named document on the HR file: it leaves the list for an Archived fold, read-only until Unarchive',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Open a named document on the Documents view and press Archive. A confirm names the act, and the document leaves the Named documents list for an Archived fold at the foot. Nothing is deleted.',
    'Open an archived document from the fold to read it. It has no Edit press and says the day it was archived; Unarchive puts it back on the list, its text and its history as they were.',
    "The agent's seat lists archived documents as such and cannot change one until it is brought back, so a retired document stays retired.",
  ],
}

export default note
