import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6336',
  date: '2026-11-02',
  title: 'Scanned papers are read into the search index by our own OCR, once it is set up',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A scanned PDF or a photo of a page has no words of its own for the index to read. Once the office sets up our OCR, the index sends the scan to it and keeps the words, so Find a file finds a scanned permit by the words on its page and shows the line.',
    'The index reads a scan once, the first fifteen pages, and keeps the page count. A scan the OCR refused is tried again a day later with the reason kept, never over and over.',
    'Every ten minutes the sweep reads five waiting scans, so the scans the backfill held catch up on their own after the setup. A dev can run one probe call to see the provider’s own answer.',
  ],
}

export default note
