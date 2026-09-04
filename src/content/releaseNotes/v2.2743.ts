import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2743',
  date: '2026-09-04',
  kind: 'feature',
  title: 'Signed agreements: the office hears about every signature — and the job is one click (or zero)',
  highlights: [
    'When a customer accepts an estimate or a GC signs a bid-room proposal, assistants, masters, controllers and devs get one clear email: who signed, the option and amount, the project, and buttons to open the signed record and create the job.',
    'Settings → Emails & reports → Signed agreements: pick the recipients (or leave the role default) and, if you want, switch on automatic job creation for estimates, for bid-room proposals, or both.',
    'With auto-create on, the job is made with the next number and the accepted lines as Specific Work, linked to the bid, and the email says "Open job J####" instead.',
    'The "Create the job" button in the email opens the record with the Create-job window already up.',
  ],
}

export default note
