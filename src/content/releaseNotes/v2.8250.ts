import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8250',
  date: '2026-11-21',
  title: 'Write someone up: the kept note goes once the write-up has sent',
  kind: 'fix',
  highlights: [
    'A write-up sent with no signal is kept on the phone and goes by itself when the signal is back. The yellow note that said it was kept used to stay after that.',
    'The note now gives way to Sent to HR, with the time it went.',
    'If the office’s rules refuse a kept write-up, the note goes and the write-up’s own line says why.',
  ],
}

export default note
