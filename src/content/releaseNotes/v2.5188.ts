import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5188',
  date: '2026-10-10',
  title: 'GC mode: start a schedule from a template',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev can save a GC job’s schedule as a template from the Templates card under its chart.',
    'A new job’s first draft can start from a template. The line under it says how much it covers and the weeks it makes.',
    'Each template shows the job it came from and the jobs drawn from it, and can be renamed or set aside.',
  ],
}

export default note
