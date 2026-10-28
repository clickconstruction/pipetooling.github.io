import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6017',
  date: '2026-10-28',
  title: 'Retainage held is released: the final pay application, or a release bill at job close',
  kind: 'feature',
  highlights: [
    'On a trade job with pay applications, the AIA window now offers the final application. When the latest application still holds retainage, the history shows Final application beside New application and opens the next one at 0% retainage. In the form, once the work is all in, a green note says what setting retainage to 0 releases and how much more is due, with a Release it · 0% press. The bill you tie to that application carries the release.',
    'On a trade job with no pay application, the Retainage held line on Accounts Receivable offers Draft the release bill…, and so does the job’s lien details once our contract on the job has ended. The draft is a bill for the held amount with the memo Retainage release, ready to send from the job’s Bill tab. Nothing goes out until you send it.',
    'The Retainage held line follows the release: release drafted · not sent yet, then release billed · awaiting payment with the figure struck through, and it leaves when that bill is paid. The lien details say the same under the retainage box.',
    'Partial releases, and the retainage we hold back from our own subs, are not part of this.',
  ],
}

export default note
