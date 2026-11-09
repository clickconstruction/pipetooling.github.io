import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6798',
  date: '2026-11-09',
  title: 'Delete for a row made by mistake: the start date no longer holds it',
  kind: 'fix',
  highlights: [
    'Found on the first live press: a hire with a start date was told it could not be deleted because of "a row in employment stints". That row is the person\'s own start date, written from their record the moment they were hired. It is the record, not history, so Delete no longer counts it and it goes with the person.',
    'Hours, pay reports, paperwork, customers and every other row that points at a person still hold the delete and hand you to Archive instead.',
  ],
}

export default note
