/**
 * What the job window holds (punch list #187, PR 3): the card behind the ? at the end of the tab
 * bar. One row a tab, the icons on a desk and the bar on a phone, and the door to the window's
 * guide. Held by `deskLegendFailures` in `deskLegends.test.ts`. Pure.
 */
import type { DeskLegend } from '../help/deskLegend'

export const JOB_WINDOW_LEGEND: DeskLegend = {
  key: 'job-window',
  label: 'What this window holds',
  rows: [
    { key: 'job', label: 'Job', accent: '#2563eb', note: 'The read view. The address, the customer, the activity feed and a Costs card.' },
    { key: 'edit', label: 'Edit', accent: '#2563eb', note: 'The job itself. Numbers, name, address, service type, the people and the customer.' },
    { key: 'bill', label: 'Bill', accent: '#059669', note: 'Money in. The line items, then the bills and the payments that paid them.' },
    { key: 'costs', label: 'Costs', accent: '#dc2626', note: 'Money out, told straight. Four numbers first, then where the money went.' },
    { key: 'history', label: 'History', note: 'One row per day worked, and the lien timeline while money is still owed.' },
    { key: 'documents', label: 'Documents', note: "The job's pay applications, bills, contract, test reports, lien paper and folders." },
    { key: 'icons', label: 'The icons', where: 'desk', note: 'Share, supply house, send as task, calendar, mail and the gear work from any tab.' },
    { key: 'bar', label: 'The bar', where: 'phone', note: "Status opens the status rail. The middle button is the job's next move. Note jumps to the note box." },
  ],
  guide: { slug: 'job-window-tabs', title: "move between a job's Job, Edit, Bill, and Costs tabs" },
}
