import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6808',
  date: '2026-11-09',
  title: 'Material counted under the wrong job can move to the right one, every box keeping its label',
  kind: 'feature',
  highlights: [
    'When a site\'s cages and boxes were counted on the phone under the wrong job, a developer can now move all of it to the right job in one step: the places, the boxes, every count and press, the box moves and the photos.',
    'Every cage and box keeps the code printed on its label, so no label is reprinted, and its lines, counts and history read as they did. If the right job already has a box with the same stencil, the one that moved takes a number, like A1 (2).',
    'Both jobs get a note saying what moved and where. A photo already saved to Drive stays in the first job\'s folder and still opens from its box.',
    'A press sent from a phone that still has the old job open now lands on the box\'s own job. Whoever counts on site needs to be on the new job\'s team.',
  ],
}

export default note
