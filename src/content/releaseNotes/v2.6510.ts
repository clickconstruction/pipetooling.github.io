import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6510',
  date: '2026-11-04',
  title: "A locked bid's letter and base price say what was sent",
  kind: 'fix',
  roles: ['dev', 'estimator', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a bid that has gone out, the price on their letter and the Cover Letter now read the figure that was sent, not what the book prices it at today.',
    'The line under the strip still says both, so you can see how far the book has moved.',
    'Revise… puts the live figure back while you price; a custom amount on the letter and an options letter keep their own figure.',
  ],
}

export default note
