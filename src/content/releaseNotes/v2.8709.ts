import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8709',
  date: '2026-11-27',
  title: 'The Bridge: the ground for a Build job that waits, with a reason',
  kind: 'infra',
  highlights: [
    'The Build desk says to crew a stalled job or name why it waits. Until now there was nowhere to name it.',
    'This change adds the place where a job’s wait is kept: the reason, who marked it and when, and who lifted it.',
    'Nothing on a screen changes yet. The press on the Build desk comes next.',
  ],
}

export default note
