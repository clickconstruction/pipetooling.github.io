import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8531',
  date: '2026-11-24',
  title: 'Write someone up: a stray pick is not kept, and the Add Task strip reads at night',
  kind: 'fix',
  highlights: [
    'Picking a person and leaving the sheet without filling anything in no longer leaves 1 not finished on the Write someone up press. A write-up you began is still kept.',
    'The Add Task strip at the top of a phone can be read in the dark theme. Its words were dark brown on a dark strip.',
  ],
}

export default note
