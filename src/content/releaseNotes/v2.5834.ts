import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5834',
  date: '2026-10-24',
  title: 'The Bridge: the Bill card counts finished work, not the whole contract',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The Bill card’s “finished, not yet billed” was the Dashboard’s Not billed figure: the whole unbilled contract on every working job, finished or not. A job half done with nothing billed put its whole price on the pile, so the card read $260k where the finished share was under $50k.',
    'The pile now reads each working job as the percent done times the contract, less what is billed or paid, and a ready-to-bill job as its whole remainder. A job with no percent takes the newest field report’s answer; one with neither reads as half done and is drawn grey, the way Build does, with “set the %s” on the badge.',
    'The pile per job behind the dial, This week’s “Bill the finished work” move, the Money owed panel and the Truth check rows read the same figure.',
  ],
}

export default note
