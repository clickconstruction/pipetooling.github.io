import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4774',
  date: '2026-10-06',
  title: 'GC mode: the plans window on real data, behind a dev door',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The plans window opens on the newest set and lists its sheets and sections as they stood at any set, with what each set changed, added, renamed and took out.',
    'A sheet a set took out stays to read, crossed out. Under each sheet, the scope lines that read from it, trade by trade.',
    'Only devs see it while the real build goes on. The sheet’s own page comes with the PDF reader.',
  ],
}

export default note
