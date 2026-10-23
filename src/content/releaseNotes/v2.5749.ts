import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5749',
  date: '2026-10-22',
  title: 'Jobs: the Costs tab prints as a packet',
  kind: 'feature',
  highlights: [
    'The job window’s Costs tab has a Print button on its first line, after the % done. It lays the whole tab out as four Letter pages: the job at a glance with the margin, the three tiles, the chart and how the margin builds by section; the baseline and where the money went, with the people, the sub sheets and the supply house invoices behind it; the card charges by cost line, the pace and a notes box; and one row per day.',
    'Every number on the pages is the tab’s own, printed at the moment you press it, with the date, the time and your name on every sheet.',
    'Owners, controllers and master techs see the button, the same roles that see the margin.',
  ],
}

export default note
