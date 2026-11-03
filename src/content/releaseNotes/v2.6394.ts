import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6394',
  date: '2026-11-02',
  title: 'A homeowner is on the residential flow everywhere',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A customer whose record says residential now reads on the residential flow wherever the app shows a flow: the step card beside their thread, Follow up’s Nudges from the flow, and the morning run. Until now every one of them read as a GC customer, so Booked, Approved, Paid and Review asked never came up for a real homeowner.',
    'The rule is one fact: the customer record’s type. Classify a customer as residential and their flow follows; nothing on the contact changes, and nothing is re-kinded.',
    'Follow up’s Nudges from the flow now lists a homeowner’s due reminders, read from their Pipeline job, and the Customer board on Settings → Flows leaves homeowners off, as the residential one holds them.',
    'The morning run still holds GC customers back, and says so in its summary as before.',
  ],
}

export default note
