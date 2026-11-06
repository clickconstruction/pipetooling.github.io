import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6556',
  date: '2026-11-06',
  title: 'A machine’s check photos file into the machine’s own Drive folder, under a Fleet folder the office sets',
  kind: 'feature',
  roles: ['dev', 'assistant', 'master_technician'],
  highlights: [
    'The sweep that files job photos now files a machine’s check photos too, every few minutes, into a folder of the machine’s own rather than the job’s.',
    'The folder is made the first time a photo lands, under the Fleet folder set on Documents → Where files go, and named by the unit: E-12 · Kubota KX040. A rental’s is named by the agreement, so a damage claim finds it.',
    'Each photo keeps the name the phone gave it, the day, who took it, the unit, which check and which shot, with (2) when the folder already holds the name.',
    'Until the Fleet folder is set, each photo’s row says so and is tried again on the next run. Nothing on a screen changes yet.',
  ],
}

export default note
