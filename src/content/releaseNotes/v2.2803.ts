import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2803',
  date: '2026-09-05',
  title: 'Forms: the office is told when its section is due',
  kind: 'feature',
  highlights: [
    'People → Contracts now opens with "Office sections to complete": every signed I-9 waiting on Section 2, with a Complete button and the deadline. Those people count under Needs attention and the row says "office section pending".',
    'On the signing page the office\'s part of the form is shaded and labelled, so the employee is never puzzled by blank boxes that are not theirs.',
    'Completing the office section now asks for the attestation the form itself requires, shows who signed the other half and when, and locks that half on screen. The record says the office attested.',
    'Signing the I-9 on a shared device? If a staff member is signed in, the thank-you page offers "Complete the office section" right there.',
  ],
}

export default note
