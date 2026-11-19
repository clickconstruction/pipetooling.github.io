import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7913',
  date: '2026-11-19',
  title: 'Job files: the app can read a file in a job’s Drive folder',
  kind: 'feature',
  highlights: [
    'The app could open a file in a job’s Drive folder in Drive’s own viewer. It could not read the file itself, so it could not print from it.',
    'The office’s door to a job’s folder now hands a file’s own pages to the signed-in reader. It answers only for a file inside that job’s folder.',
    'Nothing on screen changes yet. The Lien desk’s copies to mail will print the clerk’s stamped scan through this door.',
  ],
}

export default note
