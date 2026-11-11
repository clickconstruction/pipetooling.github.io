import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6906',
  date: '2026-11-10',
  title: 'Permits: New Braunfels cards name the general contractor',
  kind: 'fix',
  highlights: [
    'New Braunfels lists a permit once for every person on it. A card could show an electrician or a second applicant as who pulled it.',
    'A card now names the general contractor when the city has one, and the first applicant when it does not.',
    'The names change on the next pull of New Braunfels. About one card in seven is affected.',
  ],
}

export default note
