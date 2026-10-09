import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5051',
  date: '2026-10-09',
  title: 'Submittals: the watching switch reads in dark mode',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On the Share step, a person set to watching showed a blank white box in dark mode. The switch now reads watching in dark letters on a light box, like the app’s other switches.',
    'Light mode looks the same as before. The green deciding switch is unchanged.',
  ],
}

export default note
