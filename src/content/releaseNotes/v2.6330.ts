import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6330',
  date: '2026-11-02',
  title: 'Projects: every working project as one picture, with the expected hours as a slider inside the labor budget (punch list #242, PR 3)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'Jobs → Pipeline has a Projects press beside Forecast. It opens one page where every working project is a card, worst first. The strip on the card is the labor budget, filled by the real days the crew worked and divided by its stages.',
    'Hover a day to read who clocked, the subs, what was bought and the report. Hover a stage’s end bar to read what the budget set aside to reach it. Press the title to open the card large.',
    'Slide the expected hours under the strip, say why, and press Keep it. The slider runs from the hours already in to the budget’s edge. A job at the edge is pinned, and the budget on the Costs tab is the lever.',
    'Recent changes at the top lists who moved which number and why, with Undo the last change. The leader and the office set; a superintendent reads the whole board.',
  ],
}

export default note
