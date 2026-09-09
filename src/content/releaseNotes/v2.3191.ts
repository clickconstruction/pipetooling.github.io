import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3191',
  date: '2026-09-09',
  title: 'Burn reaches Job Summary and the Pipeline',
  kind: 'feature',
  highlights: [
    'Jobs → Job Summary gains two columns: Burn (percent of budget spent beside percent complete, red when spend leads progress by more than five points) and Proj. margin, the true margin each in-progress job is heading for. Sort by it and the jobs in trouble float to the top.',
    'Jobs → Pipeline: when any open job is burning ahead of its progress, Today’s money opportunities shows "N jobs burning ahead of progress — $X of margin at risk", names the worst three, and opens the worst on its Costs tab in one tap.',
    'Same arithmetic as the Costs tab’s Burn section, over the figures Job Summary already carries. Owners, controllers and master techs only.',
  ],
}

export default note
