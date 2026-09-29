import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4182',
  date: '2026-09-29',
  title: 'What the team sees: every team email now renders live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees opens the weekly CT↔PT roster audit on a sample drift — an unmanaged CountTooling seat and a backfill candidate — as devs receive it on Monday.',
    'That was the last of the twenty-five team emails: every row now renders the real email on sample data, so the "built on the server" state and its filter are gone.',
    'The audit email is unchanged: its renderer moved out of the function into a shared kernel the browser can run.',
  ],
}

export default note
