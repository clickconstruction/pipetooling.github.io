import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7796',
  date: '2026-11-18',
  title: 'Lien desk: a window that has closed has its own bin at the foot of each column',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Board has a closed end under each column. Window closed · no notice sits under Sent. Lien day passed · not filed sits under Served. Each shows only while a job is in it.',
    'The closed bins are dashed with grey chips and no arrow runs into them, since nothing there can be rushed. An amber chip is a month a late notice can still save.',
    'A lien affidavit not filed by its day now stands in the closed bin whatever stage it had reached. An approved one used to stay red in Ready to file, and the print for notarization counted it.',
    'A notice leaves its closed bin once someone records its months closed. Missed no longer stands on the heading line.',
  ],
}

export default note
