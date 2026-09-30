import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4180',
  date: '2026-09-29',
  title: 'What the team sees: the Field report email renders live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees opens the Field report email on a sample job-completion report — the template, the job, who filed it and when, every field in order, the signature shown as captured — as subscribers receive it.',
    'The email is unchanged: its builder moved out of the function into a shared kernel the browser can run.',
    'Twenty-three of the twenty-five team emails render live; two to go.',
  ],
}

export default note
