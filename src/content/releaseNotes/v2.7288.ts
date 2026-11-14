import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7288',
  date: '2026-11-14',
  title: 'The customer portals are sent up at half the size',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. The customer portal and thirteen other server functions carried every shared kernel when they were sent up, because one shared index listed them all.',
    'The index now lists only the kernels a function reads through it. The customer portal went from 3.01 MB to 1.64 MB, and the other thirteen fell by about the same.',
    'A test keeps it that way: a kernel listed in the index that no function reads through it fails the build.',
  ],
}

export default note
