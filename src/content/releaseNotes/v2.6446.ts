import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6446',
  date: '2026-11-03',
  title: 'The hours statement can be charged to the customer instead of paid to the worker',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'In the Hours statement window, tick Charged to the customer, not paid to the worker. The paper becomes a Statement of hours charged: each of the person’s days as the crew it was part of, at the rate card or the job’s rule, with a Charged band in place of Paid.',
    'Two people out together are priced once, on whichever paper lists that day, and the line says who else was out. A day the rate card cannot price is listed with no amount and the reason.',
    'The line under the switch says how the job charges its labor; the Job Summary’s Charges window changes it. The pay switch goes quiet while the paper is charged.',
    'The saved statement reads hours charged in the Documents tab and on the person’s desk. The single Rate charged for an hour card in Settings folded into Rates charged by crew.',
  ],
}

export default note
