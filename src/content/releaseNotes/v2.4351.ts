import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4351',
  date: '2026-10-01',
  title: 'Pipeline: the progress bar shows where the money is, and a tick shows the work',
  kind: 'feature',
  highlights: [
    'Each block on the bar is a line item or a stage. It fills with its money: green paid, blue billed, amber done but not billed, grey not yet.',
    'A dark tick marks the % done. It is hollow when the crew has worked since the % was set, and the date beside the box turns amber.',
    'Stage names sit under their blocks on one line, the crew’s stage in bold. The words under the bar are gone, and the legend leaves out rows with no money.',
    'A job with no price shows an Add the price button in place of the red pill.',
  ],
}

export default note
