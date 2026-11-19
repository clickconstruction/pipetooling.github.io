import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7953',
  date: '2026-11-19',
  title: 'Pipeline: the line no longer says the refresh did not land while it is still landing',
  kind: 'fix',
  highlights: [
    'Opening the Pipeline on a device that remembered the board showed, for a second or more, a line saying the refresh did not land. Nothing had failed. The last read was still out.',
    'The line now reads Updating jobs… with the board from chip until the live board is on screen.',
    'The line that says the refresh did not land now shows only when the live read fails.',
  ],
}

export default note
