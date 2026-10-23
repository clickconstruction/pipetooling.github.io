import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5782',
  date: '2026-10-23',
  title: 'Prospects: the Subs lane opens on what GC mode needs right now',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'estimator', 'dev'],
  highlights: [
    'Prospects → Subs now opens on a panel, What GC mode needs right now: one row a trade. A trade short of quotes names the project, the quotes in and the due day. A trade on the bench says how many do it, how many answer and how many more the bench wants.',
    'Each row leads to the companies to call, in order: Ask them → opens Trade partners when a bench company is not asked yet, Call for the trade shows the subs waiting here, and Add a sub opens New Prospect with the trade filled in. The blue one is the best next press.',
    'The scope book’s trades nobody does yet sit under the rows as chips, so the lane is never blank. A chip opens Add a sub on that trade.',
    'On GC projects, a link to Trade partners can now name a trade and the page scrolls to its bench.',
  ],
}

export default note
