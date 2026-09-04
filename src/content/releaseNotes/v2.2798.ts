import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2798',
  date: '2026-09-04',
  title: 'Signed forms: the answers at a glance, the PDF behind a gate',
  kind: 'feature',
  highlights: [
    'Opening a signed form on People → Contracts now shows the answers the signer gave, in the form\'s own order, with sensitive numbers shown as last-four only.',
    'Open signed PDF fetches the filled, flattened form. Only devs, controllers, and pay-approved masters can, and every open is logged.',
    'The Person Desk paperwork list marks form documents so you can tell a filled W-9 from an uploaded link.',
  ],
}

export default note
