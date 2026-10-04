import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4495',
  date: '2026-10-04',
  title: 'Job window: bills and test reports on the Documents tab',
  kind: 'feature',
  highlights: [
    'The Documents tab now lists the job’s bills that went out, with the amount and where each stands.',
    'Press a bill’s name to open View bill. Press PDF to get the invoice in a new tab. A Stripe bill links to the customer’s page.',
    'The tab also lists the job’s test reports. A sent report opens the PDF the GC received, and a draft opens the Test report window.',
  ],
}

export default note
