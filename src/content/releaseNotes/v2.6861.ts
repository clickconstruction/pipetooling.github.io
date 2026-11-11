import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6861',
  date: '2026-11-10',
  title: 'Permits: New Braunfels, San Marcos and Seguin',
  kind: 'feature',
  highlights: [
    'The city box on Prospects, Permits now lists New Braunfels, San Marcos and Seguin beside San Antonio and Austin. Each has its own Skim, Kept, Pursuing, Closed, Builders and count.',
    'New Braunfels names the applicant and the contractor. San Marcos and Seguin publish no name on a permit, so their cards say nobody is named.',
    'Where a city sends a link to its own page for a permit, the building\u2019s sheet has a new press, Open this permit at the city. Seguin and Austin do.',
    'Each new city\u2019s building sheet opens its own county clerk\u2019s deed search: Comal, Hays and Guadalupe. None of the three cities publishes a declared value, so the value filter lets all of their permits through.',
  ],
}

export default note
