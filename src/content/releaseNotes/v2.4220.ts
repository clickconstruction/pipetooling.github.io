import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4220',
  date: '2026-09-30',
  title: 'The Bridge: a day cell opens its card, and says why it is red',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Click any cell on Vectors by the day and a card opens under the grid: the jobs worked at their earned rate beside the wage, the labor line, the contribution, and one sentence saying why the day reads red or green — in the job’s terms, never the person’s pace.',
    'Three doors on the card: open the job on the Pipeline, set its % complete on Job Summary, or open that day on People → Review.',
    'Under each name, a Why line counts the red days by job — “7 red · all on 990” reads as a pricing problem at a glance, not a slow person.',
    'A ↻ on a day means last week’s rates read it the other way: a % update or the hours landing since re-priced every day on that job.',
  ],
}

export default note
