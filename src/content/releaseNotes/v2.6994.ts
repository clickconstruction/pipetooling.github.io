import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6994',
  date: '2026-11-12',
  title: 'Lien help sheets: a code to scan that opens the place to record the filing and the mail receipts',
  kind: 'feature',
  highlights: [
    'The help sheet in front of a lien affidavit prints a second code, marked Scan to record, beside the steps for after the notary. Scan it with a phone and it opens that job’s affidavit tab, where Record filing… and Record service… are.',
    'The help sheet in front of a batch prints one too. It opens the Lien desk’s Affidavits list, each job a press from its own affidavit tab.',
    'The steps on both sheets now say when to scan. The batch sheet’s last step also asks for each mail number and a photo of each receipt, as the form does.',
    'The code adds no page. The fullest cover sheet still prints on one page, and a batch of twelve on two.',
  ],
}

export default note
