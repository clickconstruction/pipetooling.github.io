import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8503',
  date: '2026-11-24',
  title: 'Papers before a job opens: the GC reads what the paper asks and who has signed',
  kind: 'feature',
  highlights: [
    'On a job that requires a paper built from settings, the GC now reads about it on the page they already open. It says the level and each topic’s choice in plain words.',
    'It counts how many people have signed, and lists each sub business with the day it finished signing.',
    'No worker is named. A sub with no company on file shows under their own name.',
    'The GC can read only. It shows after the update is switched on, and only a test job can take such a paper today.',
  ],
}

export default note
