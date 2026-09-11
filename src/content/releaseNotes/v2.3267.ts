import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3267',
  date: '2026-09-10',
  title: 'Price it with the robot — the door on Bids → Pricing',
  kind: 'feature',
  highlights: [
    'Under Supply house prices ▾ there is a new item, Price it with the robot. It lists every vendor quote link you pasted on the bid’s Price requests table, lets you untick one, says plainly what the robot will and won’t do, and queues it — nothing is emailed and nothing on the bid changes.',
    'The Price requests chip shows where the robot is: Robot pricing · queued, reading, or blocked, then Matrix ready · 23 picks, 4 to settle. Tap it to see the details, take a queued request back, or open the compare once it is ready.',
    'The robot that actually reads the quotes arrives in the next step; until then, queued requests wait. Devs see them on Robots → Queue under Price matrices, with the prompt to run one by hand.',
  ],
}

export default note
