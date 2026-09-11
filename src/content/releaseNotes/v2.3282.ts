import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3282',
  date: '2026-09-11',
  title: 'Catch Floaty, then shoot the ring',
  kind: 'feature',
  highlights: [
    'The small visitor can now be caught: press on him while he plays and he stops instead of leaving. A ring floats up somewhere else on the screen.',
    'Pull him back like a slingshot — a dotted arc shows where he\'ll fly — and let go. Through the middle counts from above or below; clip a ring end and he rattles back at you.',
    'Devs: Settings → Email templates & testing → Easter eggs → Tuning… sets how often he appears, how long he plays, how fast he flees and how much faster he gets by evening (he resets every morning), how long he holds after a catch, shots per catch, sling power, gravity, how much arc you see, and the ring width. Preview plays your sliders on the spot.',
  ],
}

export default note
