import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6541',
  date: '2026-11-05',
  title: 'A piece of evidence on an HR file can link a file already in Drive, so a recording over the cap still has a record',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Add evidence on People → HR takes a link to a file already in Drive beside the files it stages: a name and the Drive address. A call recording over 10 MB, or a file the office filed by hand, gets its record, its day, its memo and its chip like any other.',
    'A linked file reads “in Drive, linked” on its chip and opens the link. A record of linked files alone reads “In Drive, linked” and never waits on the Drive sweep.',
    'The dev seat’s evidence door takes the same: a file as { name, drive_url } beside one sent as bytes.',
  ],
}

export default note
