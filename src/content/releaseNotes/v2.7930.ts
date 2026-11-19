import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7930',
  date: '2026-11-19',
  title: 'Lien desk: the copies packet can be looked at before it prints',
  kind: 'infra',
  highlights: [
    'A Claude session can now build the packet that Filed liens: copies to mail would print and show it as a PDF, in one step. You can talk it over before anyone prints.',
    'The file comes from the same print the press runs: the mail sheet, each cover letter and every page of each clerk’s stamped copy. It was checked page for page against the window’s own build.',
    'Looking changes nothing. No copy is kept on a job, no filing is touched and no mailing is marked.',
    'The file holds customers’ names and addresses, so it is only ever written outside the project’s public code.',
  ],
}

export default note
