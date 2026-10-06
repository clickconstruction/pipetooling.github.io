import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4705',
  date: '2026-10-06',
  title: 'Submittals: a revision you emailed reads "sent by email", not "draft"',
  kind: 'feature',
  highlights: [
    'On Bids → Submittals, a draft you emailed to the GC yourself and typed their answers onto still read draft in the header and on its chip. Draft means unsent. It now reads Rev 1 · sent by email · Sep 29.',
    'Typing in their first answer sets it for you. To say so before any answer comes, tap Sent by email on… beside Share on step 5 and pick the day. Step 5 then reads Sent by email · Sep 29, and the Share step lights as done.',
    'A revision shared from the app keeps its words. The GC’s page is unchanged.',
  ],
}

export default note
