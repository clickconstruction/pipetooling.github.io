import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6578',
  date: '2026-11-06',
  title: 'A machine check’s photos file into the machine’s Drive folder, as promised',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'helpers', 'assistant', 'controller'],
  highlights: [
    'Since the pre-use check shipped, every photo it took stayed in the app’s own storage: the row never learned where its picture was, so the sweep that files photos into Drive never saw it. The person who took the photo can now record that, and the sweep files it within a few minutes.',
    'If a photo goes up but its record cannot be kept, the sheet now says so instead of showing a photo that looks saved, and takes the picture back so nothing is left half done.',
    'Nothing changes on the phone otherwise: the same tiles, the same gauges, the same sign press.',
  ],
}

export default note
