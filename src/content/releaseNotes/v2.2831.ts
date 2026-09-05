import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2831',
  date: '2026-09-05',
  title: 'Job Summary — a Rework view: did we have to go back?',
  kind: 'feature',
  highlights: [
    'A ninth view on Jobs → Job Summary. A return visit is a second job at the same address that started within 30, 90, or 180 days of the first being billed — found from the address already on every job.',
    'The return-visit rate by lead tech, service type, or GC against the company rate, and what the return visits cost in labor, subs, parts, and overhead.',
    'Every pair listed — first job, return, days between — each one a click away, so a planned second phase can be told from a callback.',
  ],
}

export default note
