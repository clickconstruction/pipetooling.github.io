import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8064',
  date: '2026-11-20',
  title: 'Lien desk: Months on this job asks for a tick only where one can be made',
  kind: 'fix',
  highlights: [
    'On a notice in Sent, Months on this job no longer draws a last column, This notice, of boxes nobody can tick. The notice that went is already there as a lettered paper.',
    'The line over the grid says Tick a month to put it on this notice only when a box can be ticked. A notice past editing, or one whose months are all closed, no longer asks.',
    'On a phone, a sent notice’s months use the whole width of the card.',
  ],
}

export default note
