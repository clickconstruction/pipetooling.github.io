import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7978',
  date: '2026-11-19',
  title: 'Permits: a Market view says whether the companies we bid build here',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Prospects → Permits has a new view, Market, beside Builders. It lists every company we priced a job for in two years, with our bids, our wins and the commercial permits its names pulled in twelve months.',
    'Each row says what that reads as: Builds, and we win. Builds, we never win. Too early to say. Or No permit on record, with Tie a name to find the name the company files under.',
    'The clock under the table shows how long there is to call once a city shows a job. In San Antonio it runs from an application to its permit. In Austin it runs from the building permit to the plumber’s permit.',
    'This is the first step of the Market page. The list of builders to call comes next.',
  ],
}

export default note
