import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7403',
  date: '2026-11-15',
  title: 'People → Subs: take teammates off a sub’s sheet (sub labor train)',
  kind: 'feature',
  highlights: [
    'A line under the roster counts the subs’ sheets that also name a teammate. Take the teammates off… opens them as a list, each with who keeps the sheet and who comes off.',
    'Every ready sheet starts ticked and the press says its count. A sheet that needs a look first is held with its reason and never stops the rest.',
    'No amount, payment or date changes, and the window shows the open money is the same before and after.',
    'One thing does move: People → Review and the Team Summary split a sheet’s cost evenly between its names, so each sheet’s whole cost becomes its sub’s. The window says how much.',
  ],
}

export default note
