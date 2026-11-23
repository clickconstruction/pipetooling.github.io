import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8374',
  date: '2026-11-23',
  title: 'Job Summary: the cents are smaller than the dollars on every amount',
  kind: 'feature',
  highlights: [
    'On Job Summary, every amount shown to the cent now draws its cents smaller than its dollars, so the dollars read at a glance. That covers the chart’s hover box, the red, amber and green amounts on the chart, the breakdown tables under a job, the discount fold and the average wage.',
    'A loss reads with a true minus before the dollar sign, and the cash position still says plus or minus. An amount shown in whole dollars is unchanged.',
    'Selecting and copying an amount still gives the whole figure. Tooltips, prints and the spreadsheet download are unchanged.',
    'This is the first screen. The rest of the app follows, screen by screen.',
  ],
}

export default note
