import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7966',
  date: '2026-11-19',
  title: 'Permits: Builders drops an empty plumber column, and a quiet city’s skim says so',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Prospects → Permits → Builders, San Antonio no longer shows a plumber for each builder. The city’s permits never name one, so every row read the same words.',
    'A city whose permits do name plumbers keeps the column, as Austin and New Braunfels do.',
    'When the skim is caught up in a city that has stopped publishing, it now says the city has published nothing since that day. It no longer points to tomorrow’s pull as if permits were coming.',
  ],
}

export default note
