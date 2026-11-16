import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7387',
  date: '2026-11-15',
  title: 'Box labels: change the tape mid run and keep going',
  kind: 'fix',
  highlights: [
    'When the tape runs out part way through a run, put in a new cassette and close the cover. The window checks the printer by itself every few seconds, and the print press comes back with exactly what is left.',
    'The foot of the window says why the press is grey, such as There is no tape in the printer, with Check the printer again beside it. Before this the window never looked at the printer again, and had to be closed.',
    'Print labels remembers a run that stopped part way for the rest of the day. Close the window to change the tape and it opens on the rest, with the finished boxes unticked. Press Every box to start over.',
    'The red line that says how many strips went, and why the printer stopped, now stays until the next run.',
  ],
}

export default note
