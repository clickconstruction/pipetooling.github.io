import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8564',
  date: '2026-11-24',
  title: 'Bills sent: the developer can delete a by-hand record of a test bill',
  kind: 'feature',
  highlights: [
    'On a bill’s record, the developer now reads Delete this record… under a line recorded by hand. Nobody else sees it.',
    'It deletes a record of a test bill only: a bill made in Stripe’s test mode, or a bill on a ZZ test job.',
    'A by-hand record of a real bill stays, and the line says why. No other send is ever offered for deleting.',
    'The window that asks first reads the record back, and its button reads Delete the record.',
  ],
}

export default note
