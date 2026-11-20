import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8051',
  date: '2026-11-20',
  title: 'Schedule on a phone: the block sheet and the copy bar sit right above the tabs',
  kind: 'fix',
  highlights: [
    'On an iPhone, the sheet a schedule block opens left extra empty space under Close. That space is gone.',
    'The dark bar that shows while you copy or move a block now floats just above the tabs.',
    'With no tabs at the bottom of the screen, both sit at the bottom instead of leaving room for tabs that are not there.',
  ],
}

export default note
