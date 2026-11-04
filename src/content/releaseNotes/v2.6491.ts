import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6491',
  date: '2026-11-04',
  title: 'The file index keeps a revised file’s newest sense, reads a scan on one download and takes held files again',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A file indexed again while the sweep was giving it its sense of meaning ends with the new text’s sense, not the old one’s, and a file emptied to a blank page keeps no sense of its old words.',
    'A scanned PDF that Drive lists with no kind of its own, as a phone or a fax line drops it in, now goes to OCR by its name on the next sweep instead of waiting for the file to change.',
    'A scan the sweep sends to OCR costs one download and no re-read of the file, so the sweep’s own clock is never spent on it.',
    'A file the index once held as slow, because its read ran out of time, is taken again an hour later instead of staying held until someone presses Index again.',
  ],
}

export default note
