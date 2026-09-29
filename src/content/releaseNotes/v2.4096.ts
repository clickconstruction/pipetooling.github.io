import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4096',
  date: '2026-09-28',
  title: 'Pipeline: the lien runway shows the notice a sub owes first, and says "file lien by"',
  kind: 'feature',
  highlights: [
    'On a job with a GC, Texas wants a § 53.056 notice to the owner and the GC before any lien. The runway under the row now shows it: a hollow flag at the notice date ahead of the lien flag, and the sentence reads "notice by Oct 15 · lien by Nov 16" over "send the notice · 17 d".',
    'Once the notice is recorded the hollow flag becomes a small check and the sentence goes back to the money and the lien. A notice window that closed unsent reads "lien gone · notice window closed".',
    'The lien date now says what it is everywhere: "file lien by Dec 15" is the last day to file the affidavit, not a day to send anything. Direct homeowner jobs have no notice step and are otherwise unchanged.',
    'On a phone the row\'s one chip reads "notice in 17 d" while the notice is owed and inside three weeks.',
  ],
}

export default note
