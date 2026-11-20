import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8071',
  date: '2026-11-20',
  title: 'HR files: Waiting on you no longer goes quiet when it has something to say',
  kind: 'fix',
  highlights: [
    'When the list of plans an agent kept for your yes cannot be read, People → HR says so with the reason and a Read it again press. Before, the list was simply gone, as if nothing waited.',
    'With a person’s file open, a line now names the other people a plan waits on, also when the open file has no plan of its own. Press a name to open that file.',
  ],
}

export default note
