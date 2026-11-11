import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6882',
  date: '2026-11-10',
  title: 'A supply house bill you typed gets its lines by itself, read from the PDF it links',
  kind: 'feature',
  highlights: [
    'On Materials → Supply houses, a bill with a Drive link no longer waits for someone to fill it from its PDF. The app opens the linked file within a few minutes of Save, reads every line and fills the bill’s Lines cell.',
    'The bills already on file are read the same way, newest first, so the Lines column fills in over the next day or two.',
    'A file that holds several bills is read once, and each bill takes the lines under its own invoice number. A bill whose number is not in its file, or whose file the app cannot open, stays at *No lines yet* until the link or the number is fixed.',
    'A bill counts toward what the company buys only when its lines add up to the paper and to the amount on its row, and every part code the reader copied is found on the paper.',
  ],
}

export default note
