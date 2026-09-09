import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3175',
  date: '2026-09-09',
  title: 'Price requests, listed on the bid',
  kind: 'feature',
  highlights: [
    'Edit Bid → Files & Links has a Price requests table under the plans: every supply house you asked, one row per request, with the day it was requested, a link to the request, and a link to the quote that came back.',
    'Requests the app sent fill in on their own — the vendor\'s quote page, whether they have viewed it, and the quote once it is plugged in on Pricing. Needed-by sits under the requested date: a green tick when the quote is in, amber while you wait.',
    '+ Add a request records one you sent by email or phone: pick the house (or add a new one right there), the date, and paste the two links. Edit it when the quote lands. Nothing is sent to the vendor from here — that still happens through Send price requests on Pricing.',
    'Requests added by hand show on the Pricing desk too, tagged "sent outside the app", so who-did-I-ask is one list.',
  ],
}

export default note
