import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7925',
  date: '2026-11-19',
  title: 'Schedule emails: a preview answers only the people who may ask for it',
  kind: 'fix',
  highlights: [
    'The preview in the Schedule’s Share window now reads for the person signed in and nobody else. It shows the same board as before.',
    'The preview in the Dashboard’s Email schedule window reads for you. The office also reads it for the person picked under Send to, as before.',
    'A primary’s schedule email, and its preview, now list the visits assigned to them and the jobs they are the account manager of. They listed every job before.',
    'Everyone else’s schedule emails are the same.',
  ],
}

export default note
