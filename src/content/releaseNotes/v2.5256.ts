import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5256',
  date: '2026-10-12',
  title: 'Messages: the rules for a job’s files going out',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. The app now holds one list of a job’s files, from the papers it makes to the job’s Drive folder.',
    'An email takes a file up to 10 MB, and 20 MB for all its files together. Anything bigger, and any plan set, goes as our own link.',
    'A text carries every file as our link, photos too. The link opens their portal at the right page when it has one.',
    'A sent message keeps each file with how it went, so the copy is the copy.',
  ],
}

export default note
