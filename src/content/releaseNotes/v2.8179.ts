import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8179',
  date: '2026-11-21',
  title: 'Maps: a map of dots waiting on Google Maps says it is loading',
  kind: 'fix',
  highlights: [
    'A map of dots that is waiting on Google Maps now says Loading the map… in the middle of its frame. Before, the frame was an empty grey box.',
    'On a weak signal that wait can last ten seconds before the other map comes up in its place.',
    'It is the same line on every map of dots, such as Where my tasks are on the Checklist and the map of your jobs on the Dashboard.',
    'The words are a shade darker than the map’s old loading line, so they read on the grey frame in light and in dark.',
  ],
}

export default note
