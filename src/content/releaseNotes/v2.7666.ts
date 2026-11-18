import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7666',
  date: '2026-11-17',
  title: 'Tell the dev: an account in training mode can send a note',
  kind: 'feature',
  highlights: [
    'An account in training mode can now send a note to the dev from the wrench. Before, the note was refused like every other change.',
    'It is the one new thing a training account can write. It still cannot change a job, a bid or anything else.',
    'People learning the app are the ones a page confuses most, so their notes matter.',
  ],
}

export default note
