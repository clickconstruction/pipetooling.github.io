import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6980',
  date: '2026-11-11',
  title: 'Permits: the owner read from the county the lot is in',
  kind: 'fix',
  highlights: [
    'A city reaches over its county line. Four New Braunfels addresses in ten are in Guadalupe County, and the Property line only asked Comal County.',
    'When the city’s own county holds nothing at the permit’s point, the app now asks the neighbouring county there.',
    'Measured on 200 addresses each: New Braunfels cards that name an owner go from 119 to 199. San Marcos cards go from 145 to 166.',
    'The card names the county the lot is in, and its link opens that county’s appraisal district.',
  ],
}

export default note
