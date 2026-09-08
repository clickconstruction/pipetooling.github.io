import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3174',
  date: '2026-09-08',
  title: 'Robot questions link to their bid',
  kind: 'feature',
  highlights: [
    'In Bids → Audits → Standing rulings, the bid number inside a robot\'s question (the "b474" in "[audit b474 / footage…]") is now a link. It opens that bid on the Bid Board in a new tab, scrolled to and highlighted, so you can see what the robot is talking about before you answer.',
    'A question that only says "this bid" gets a small "· b474" link after it, pointing at the bid the robot was working on.',
  ],
}

export default note
