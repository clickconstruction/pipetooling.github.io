import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7567',
  date: '2026-11-17',
  title: 'Stickers: a job says which reserved stickers have not printed yet',
  kind: 'feature',
  highlights: [
    'A reserved run used to read Printed with its day, whether or not a strip came out. It now reads Reserved, and the line says what printed: None printed yet, 40 printed and 18 not printed yet, or All printed.',
    'A run that stopped part way has a new press on the job’s reserved line, Print the 18 not printed yet. It prints only the stickers that never came out, even after the window was closed.',
    'Over USB the app marks a sticker once every copy of it is out. Through the print window it marks the stickers when that window closes, and Take the mark off undoes it if nothing printed.',
    'Runs made before November 17 say nothing about what printed until one of their stickers prints. A test strip is never marked.',
  ],
}

export default note
