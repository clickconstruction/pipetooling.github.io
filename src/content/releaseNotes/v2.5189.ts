import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5189',
  date: '2026-10-10',
  title: 'GC mode: a rough schedule for our bid',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'While we bid a GC job, a dev can draw a rough schedule from its stages, or from a template, to know the weeks to build.',
    'Our number shows the weeks to build, with a line to copy into the proposal.',
    'When our bid goes in, the rough keeps its weeks as they went. When we win, the first draft starts from it.',
  ],
}

export default note
