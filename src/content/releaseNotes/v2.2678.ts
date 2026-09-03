import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2678',
  date: '2026-09-03',
  title: 'People → Review opens with a verdict, a ranking, and the math',
  kind: 'feature',
  highlights: [
    'The Review tab now leads with profit after overhead for the period, a trend pill against the period just before it, and a bar showing how gross revenue became profit.',
    'Everyone is ranked on one axis. Field crew grow to the right; office and bid people, whose wages are the overhead pool, draw to the left of a zero line so they read as what they are. Rank by profit, profit per hour, gross, or net, and search by name.',
    'Click a name and the math opens beside the list: the formula with this period’s figures, what moves it (jobs with no % complete, jobs with no bill, one job carrying most of the total), and the watch-outs.',
    'An amber strip names what is skewing the period — hours awaiting approval, jobs with no bill, jobs assumed 100% done, and the salaried-hours assumption. The classic table is one click away (Ranked / Table) and remembers your choice.',
  ],
}

export default note
