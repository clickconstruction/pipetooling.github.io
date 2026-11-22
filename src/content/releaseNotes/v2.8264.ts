import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8264',
  date: '2026-11-21',
  title: 'Document builder: check a trade’s certificate against a job’s sheet',
  kind: 'feature',
  highlights: [
    'Under the send on a job’s insurance sheet, Certificates for this job says where each trade’s certificate stands. A certificate is for one job.',
    'Check it against the sheet gives one line to tick for each thing the sheet asks. Mark it good needs every line and the certificate’s last day.',
    'Send it back names what the certificate did not show, and emails those lines to the trade.',
    'Raise an amount or change a name on a published sheet, and each certificate checked before reads The sheet changed. A fix to the foot line changes nothing.',
  ],
}

export default note
