import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8153',
  date: '2026-11-20',
  title: 'Document builder: publishing your usual sheet no longer writes over a teammate’s changes to a job',
  kind: 'fix',
  highlights: [
    'On Insurance requirements for subs, publishing your usual now reads each job’s sheet at the moment you press. It no longer writes a job from the page as it was when you opened it.',
    'A job a teammate changed since is held, with their changes kept. A job a teammate published since goes out from their newer copy.',
    'After the press, the card counts the jobs held and each held job’s row says why. The rest still get your usual.',
  ],
}

export default note
