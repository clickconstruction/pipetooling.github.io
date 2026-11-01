import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6260',
  date: '2026-11-01',
  title: 'The report email carries the photos',
  kind: 'feature',
  highlights: [
    'A report emailed to its subscribers now carries its photos as attachments, the small copies the phone made, up to ten and under 8 MB in all. A Photos line under the fields names each one by stage and sender with its size.',
    'A photo the sweep already filed in the customer’s Drive folder comes as a link to the file instead. One past the cap is named and not attached.',
    'The push for a new report ends with the count, as in Luis submitted a Status Report for J1042 · 2 photos.',
  ],
  roles: ['assistant', 'controller', 'master_technician', 'dev', 'estimator', 'superintendent', 'primary'],
}

export default note
