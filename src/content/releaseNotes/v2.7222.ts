import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7222',
  date: '2026-11-13',
  title: 'Lien desk on a phone: rows by the day they are due, with the money',
  kind: 'feature',
  highlights: [
    'On a phone the first view groups its rows by the day they are due, soonest first. Each heading says the day, how long is left and what its jobs still owe.',
    'A row says what its job owes, beside its name. It is three lines now: the job and the money, where the paper stands, then the paper, four dots and the button.',
    'A row is about 112 px tall, down from about 225, so twice as many fit on a screen. The button keeps its own words and is as wide as they are.',
    'The groups that say whose move it is keep their names: Only you can sign, Only you can approve, Reminders and Waiting on the leader. Nothing moves on a computer.',
  ],
}

export default note
