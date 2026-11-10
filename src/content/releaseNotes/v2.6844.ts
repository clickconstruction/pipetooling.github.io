import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6844',
  date: '2026-11-10',
  title: 'An agent can settle the proposed theme marks on a file in one plan',
  kind: 'feature',
  highlights: [
    'A theme mark an agent proposes stays dashed on People → HR until a dev keeps it. Until now the only way to keep one was the Keep press, one mark at a time.',
    'An agent on the dev seat can now plan the whole review: which proposed marks to keep, and which marks come off, each with its reason. The owner reads the plan first, and nothing changes until they say Apply it.',
    'A kept mark carries the name of the dev whose seat kept it. A mark that comes off stays on the record with its reason, as it does when you press Take it off.',
    'A mark is still never reworded. One that sits under the wrong theme comes off and is made again under the right one.',
  ],
}

export default note
