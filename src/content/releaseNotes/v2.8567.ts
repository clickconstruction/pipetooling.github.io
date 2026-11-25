import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8567',
  date: '2026-11-24',
  title: 'Lien window: the developer can delete a voided by-hand notice record on a test job',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'In a job’s Lien window, the developer now reads Voided by-hand notice records, folded behind Show. Nobody else sees it.',
    'It lists the job’s voided notices that were recorded by hand, each with Delete…. On a real job every press is dead and says why.',
    'A record stays when a desk paper, a bill’s pay offer, another record or a sent copy points at it, and its line says which.',
    'The window that asks first says how many records go and that the line on the job’s Activity stays. Its button reads Delete the record.',
  ],
}

export default note
