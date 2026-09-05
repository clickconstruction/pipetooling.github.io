import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2879',
  date: '2026-09-05',
  title: 'Add customer asks "Started as a prospect?" and closes the loop; the Convert tab starts on search',
  kind: 'feature',
  highlights: [
    'Add customer (Customers, Bids, Estimates, /customers/new) has a new first field, "Started as a prospect?" — type a company, contact, phone, or address, pick the prospect, and the form prefills. Saving the customer marks that prospect converted, so it leaves the calling queue and shows under Converted on the Prospect List. Nothing is written until you press Save; Cancel leaves the prospect exactly where it was.',
    'Prospects → Follow Up "Converted ✓" now creates the customer instead of only flagging the prospect: it opens Add customer prefilled from the card with the prospect already linked; Save makes the customer, marks the prospect, and the queue moves on.',
    'Prospects → Convert no longer pre-selects whoever happens to be at the head of your calling queue. It opens on its search box with the "answered in the last 30 days" suggestions visible.',
    'Conversion notes on the prospect now name the customer with a link (/customers/…), and Activity\'s "converted" counts move for every lane.',
  ],
}

export default note
