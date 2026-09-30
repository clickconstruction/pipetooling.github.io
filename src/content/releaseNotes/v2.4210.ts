import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4210',
  date: '2026-09-29',
  title: 'Pipeline: the property badge sits right after the address',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The C / R / ? circle at the end of a job’s address now follows the last word — “Hondo, TX ?” — instead of floating out past the end of the longer street line.',
    'Nothing else about the badge changed: tap it to say residential or commercial, and every job at that address follows.',
  ],
}

export default note
