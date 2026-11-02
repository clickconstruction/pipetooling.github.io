import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6367',
  date: '2026-11-02',
  title: 'Materials on site: an agent on the dev MCP adds what the crew and the office add',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev’s agent can now read a job’s cages and boxes the way the phone and the office read them: every box with its stencil, place and lines, what waits in Unsorted, the boxes due a count, and what went missing in the last 30 days.',
    'It can add a cage or box, move or retire one, land an invoice’s lines, press a line (moved, used, returned, taken, can’t find, damaged) and count a box. Each is a dry run you read first; the write happens only while the box is as the plan saw it.',
    'Every row lands under the same rules as a press on the screen and reads “<robot> · MCP as <you>”, so the crew and the office see who did it. A training account or a digital twin is refused in words.',
  ],
}

export default note
