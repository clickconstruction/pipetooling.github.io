import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3533',
  date: '2026-09-16',
  title: 'Pipeline: the search bar moves into its own file',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Pipeline board\'s top row — New Job, Follow-ups, Forecast, the search box, the # jump and the filter chips — now lives in its own component with its own tests, and the chips and the ⋯ menu read the same filter list so they can never disagree.',
  ],
}

export default note
