import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4509',
  date: '2026-10-04',
  title: 'Pipeline map: Hide map sits in the top right corner',
  kind: 'fix',
  highlights: [
    'On Jobs → Pipeline, Hide map now stays in the top right corner of the Jobs on a map card. Before, on a narrower window it dropped to the second line, after the section chips, Fit all and Cluster.',
    'The chips and links still wrap under the title when the window is narrow. On a phone, Hide is on the title line and Crews and Cluster sit under it.',
  ],
}

export default note
