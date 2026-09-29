import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4161',
  date: '2026-09-29',
  title: 'What the team sees: the Money waiting digest renders live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees now opens the Money waiting digest on sample data — three customers off their pace, every open bill under each, exactly as the morning email lays it out. The row keeps "Show the real one" and "Email me the real one" underneath.',
    'The digest itself is unchanged: its renderer moved into a shared kernel the browser can run, and the function sends the same email it did.',
    'Twelve of the twenty-five team emails render live now; thirteen digests to go, one per release.',
  ],
}

export default note
