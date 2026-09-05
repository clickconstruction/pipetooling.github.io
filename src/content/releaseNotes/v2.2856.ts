import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2856',
  date: '2026-09-05',
  title: 'Resend a customer\'s estimate link',
  kind: 'feature',
  highlights: [
    'A sent estimate now has a Resend link button under Customer activity. The customer gets the same email again with a brand-new link; the old link stops working.',
    'After a resend the new link is shown once, with a Copy link button, so you can text it to a customer who prefers that. Only the tab that pressed Resend sees it.',
    'The Copy / Open customer link tooltip stops telling you to "ask an admin to resend" — there never was such a button — and now says where the link lives and how to get a fresh one.',
    'Estimates whose pricing has passed its good-through date, or that are accepted, declined or replaced, do not offer Resend; the page says why and points you to New estimate.',
  ],
}

export default note
