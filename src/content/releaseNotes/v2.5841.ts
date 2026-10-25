import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5841',
  date: '2026-10-25',
  title: 'Quickfill: nothing counted twice, and Office Leaving waits for the afternoon',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Lost bid reasons station is retired. The Needs you station carries the same lost bids with Fill them in, which was the better card.',
    'The clock sessions waiting on approval and the dispatch requests that have waited 3+ days leave the Needs you station on Quickfill. People Hours and the Dispatch inbox are those two stations and count them already.',
    'Schedule and Tomorrow’s Schedule are doors on every view. They no longer offer a Mark on the Page.',
    'Office Leaving joins the round from 3 p.m. Before that the Roller and the phone round skip it, and its row reads after 3 p.m. The Page still shows it.',
  ],
}

export default note
