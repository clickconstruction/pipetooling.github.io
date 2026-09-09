import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3181',
  date: '2026-09-09',
  title: 'Job Summary expanded row: cents in small type, and a % of total column',
  kind: 'feature',
  highlights: [
    'Open a job on Jobs → Job Summary and every dollar figure inside — the cost-by-person table, the team labor and card drill-downs, the parts breakdown, the overhead math — now shows its cents at the smaller size, matching the tiles and the table above.',
    'The cost-by-person table gains a % of total column: each person\'s Total as a share of the Total row, so you can see at a glance who carried the job. Tiny shares read "<1%"; the Unassigned row counts too, and the Total row reads 100%.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
