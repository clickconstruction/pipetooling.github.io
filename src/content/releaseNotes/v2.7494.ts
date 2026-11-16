import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7494',
  date: '2026-11-16',
  title: 'Development page: the plans by date, every set of drawings against time',
  kind: 'feature',
  highlights: [
    'The Plans look has a second view. Press By date to see every set of drawings on the date printed on its sheets, one lane for each part of the site.',
    'The bids, the days crews were on site and the lines kept on History share the same axis, with a line for today. Four figures on top count the sets since the bid and the days on site.',
    'Rest the pointer on any mark to read its line. Under the chart every mark reads again as a dated list, oldest first.',
    'Print or save as PDF puts the figures, the chart and the list on one landscape page. An estimator sees the chart too, since it carries no money.',
  ],
}

export default note
