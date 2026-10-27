import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5961',
  date: '2026-10-26',
  title: 'Dashboard, Checklist, Customers and Estimates: an empty list names the next press',
  kind: 'feature',
  highlights: [
    'Estimates with none says No estimates yet. New estimate adds the first. A search with no match quotes what you typed and offers Clear the search, and each Follow-up lane says its good state, like Nothing unsent. Every draft went out.',
    'On the Dashboard the Dispatch and Estimator inboxes say Nothing waiting on dispatch and where a request comes from. Ready to bill, My Schedule, My time, Crew day, AR by customer and Assigned jobs offer Stages, + Add job, Last week, Previous day or Clear the search.',
    'Checklist says Nothing due today on Today and Everyone is caught up on Outstanding. History offers Show 12 months, and Manage offers ＋ New task or Clear the search.',
    'Customers, a customer’s page, Documents’ four ledgers, Partnerships, Projects, the Calendar and Duplicates offer their own button, or a link to the page that fills the list.',
  ],
}

export default note
