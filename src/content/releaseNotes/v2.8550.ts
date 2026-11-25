import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8550',
  date: '2026-11-24',
  title: 'The merge queue says what each change is doing',
  kind: 'feature',
  highlights: [
    'On the Punch list, each change in the merge queue has a State: Checks running, Ready, Waiting its turn, Merging now or Will not merge.',
    'Settings → How fast a change ships says the same after a change’s place, as in “2nd in line, checks running”.',
    'The state shows after the next read of GitHub. Until then a line draws as it did.',
  ],
}

export default note
