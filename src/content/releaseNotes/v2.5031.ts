import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5031',
  date: '2026-10-09',
  title: 'Liens: a property kind not set dates as residential, the earlier date, everywhere',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A property whose kind is not set now shows the residential lien dates, a month earlier than commercial, on every screen. That covers the Lien desk, the Lien window, the GC run, the Forecast panel, the lien grid, and the Calendar and runway as before. The earlier date is the safe one.',
    'Every screen still asks you to set the kind. A commercial pick moves the dates a month later.',
    'The notice letter names the residential month for an unset kind too, so the letter and the screen agree.',
  ],
}

export default note
