import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3222',
  date: '2026-09-10',
  title: 'The Robot Board mirrors the Bid Board, and the robot’s envelope opens when you send',
  kind: 'feature',
  highlights: [
    'The Robot Board no longer lists the robots’ practice bids. It lists our bids, in the same sections as the Bid Board, with a robot column: sealed, queued or working before we send; the robot’s number, ours, and how far off it was after. A bid the robots ran twice leads with the newest run and keeps the earlier one a tap away.',
    'When you confirm a bid sent with its value, the robot’s envelope opens right there: its sealed number beside yours, where the dollars differ, the biggest six differences with one-tap verdicts, and any question it asked. Your number is already on record, so nothing you see can change the score. Later leaves it for the Audits lens, as before.',
    'A row on the Robot Board whose audit is still waiting has a Review now door to the same envelope, so an older robot run can be judged from the bid, not the queue.',
    'Shadows folded into the Robot Board (old links land there). The dev Queue moved to Settings → Digital twins. The Scoreboard keeps the axis cards.',
  ],
}

export default note
