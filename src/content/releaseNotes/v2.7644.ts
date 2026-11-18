import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7644',
  date: '2026-11-17',
  title: 'Contract sweep: a contract already on file is no longer offered to another job',
  kind: 'fix',
  highlights: [
    'The Contract sweep looks in Drive for signed contracts and offers each to a job with none. It no longer offers a file that is already the signed paper on another job.',
    'Before this, a contract filed on one job could show as a find to check on the same customer\'s next job.',
    'It knows the file by the file itself, not by its name, so renaming a file changes nothing.',
    'This goes live once the sweep\'s Drive reader is deployed.',
  ],
}

export default note
