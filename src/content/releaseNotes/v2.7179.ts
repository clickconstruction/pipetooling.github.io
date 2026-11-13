import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7179',
  date: '2026-11-13',
  title: 'Materials on site: change a box’s name, its kind and where it stands',
  kind: 'feature',
  highlights: [
    'A cage or box now has Edit beside its name, on the phone’s On site tab and on each box of Jobs → Materials. Until now a wrong name meant retiring the box and making another.',
    'Edit changes the name, how it sits (Cage, Box or Loose pile) and the where line. A name another box on the job carries is refused before you press.',
    'A label already printed still opens the box, because its code never changes. Only the large words are old until you print it again. The old name is kept on record.',
    'An edit made with no signal is kept on the phone and sent later, like every other press on site.',
  ],
}

export default note
