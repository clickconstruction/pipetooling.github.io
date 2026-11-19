import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7880',
  date: '2026-11-18',
  title: 'Permits: the city box says when a city has gone quiet',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Prospects → Permits, each city in the city box now shows its newest permit day, like Seguin · newest Nov 17.',
    'A city that has stopped publishing reads quiet since the day it stopped, and the box turns amber while that city is on screen. Today that is New Braunfels, quiet since Nov 3.',
    'A city reads quiet after seven days with nothing newer. San Antonio publishes a week at a time, so it gets ten days.',
    'A pull of ours that stopped never makes a city read quiet. The line under the strip still says what stopped.',
  ],
}

export default note
