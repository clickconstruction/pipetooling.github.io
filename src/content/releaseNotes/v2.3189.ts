import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3189',
  date: '2026-09-09',
  title: 'Burn: are we spending faster than we are finishing?',
  kind: 'feature',
  highlights: [
    'The Costs tab opens with a Burn section for owners, controllers and master techs: spent to date, the budget, percent of budget spent beside percent complete, and the projected cost at completion with the margin it implies. The middle pair turns red when spend leads progress by more than five points.',
    'Daily spend bars for the last 14 working days, split team labor, sub labor and parts, with a 7-day average line. The cumulative chart draws the budget as a ceiling, earned value stepping up at each field report, and a dotted forecast to the day the budget runs out at today’s burn.',
    'Overhead stays out of the burn signal and in the projection: the At Completion tile adds this job’s overhead day-share plus the days still to come, and reads the true margin the way Job Summary does.',
    'Until bid estimates are snapshotted onto jobs, the budget is the price times your Job Summary target margin (35% when the chip is off). The header says which it used.',
  ],
}

export default note
