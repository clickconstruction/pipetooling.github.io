import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3202',
  date: '2026-09-09',
  title: 'The robot icon says two things',
  kind: 'feature',
  highlights: [
    'Nobody asks for a robot any more — every plumbing bid with readable plans gets one on its own. The robot icon beside the bid number now just says how that’s going: outline while it’s queued, solid while it reads and counts, a lock once it has sealed its number, a green ✓ once you’ve sent and it’s been scored. Click it for the robot’s timeline (its number stays hidden until you send).',
    'When the robot is stuck, the icon turns amber with a “?” — or the count of questions it asked. Click it to see exactly what it needs: plans it can’t open (with the intake address to copy), and its questions, which you can answer right there.',
    'A small ? beside the Bid # header explains every state of the icon and the A–X grades. Sent bids now wear their grade too, so a missing bid value or unpriced counts get fixed before the outcome, not after.',
    'The yellow “request a robot” click is gone; “Front of the line next batch” lives inside the robot’s status sheet instead.',
  ],
}

export default note
