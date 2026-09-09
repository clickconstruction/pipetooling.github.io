import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3207',
  date: '2026-09-09',
  title: 'Robots → Queue: run the shadow queue from Claude Desktop',
  kind: 'feature',
  highlights: [
    'A new Copy Desktop kickoff button on the Robots → Queue lens copies one prompt that sets up the robot connector on a laptop with only Claude Desktop, then works the uncovered bids one at a time until the board is covered.',
    'The person in the chat drags each bid\'s plan PDF in when the robot asks; everything else — takeoff, counts, prices, the sealed lock, audit questions, the report — runs through the connector.',
    'Same rules as every robot run: blind to the human bid, never sends anything, never touches a bid that is not its own shell, and stops after three bids per chat.',
  ],
}

export default note
