import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6884',
  date: '2026-11-10',
  title: 'Lien affidavit: a homestead paper opens with the notice Texas asks for',
  kind: 'feature',
  highlights: [
    'On a property marked homestead, the short affidavit now opens with a bold line above the title: NOTICE: THIS IS NOT A LIEN. THIS IS ONLY AN AFFIDAVIT CLAIMING A LIEN.',
    'The line prints at 12 point bold in the preview, the print and the PDF. Texas Property Code § 53.254 asks for 10 point, as the app reads it.',
    'Nothing else on the paper changes, and a property that is not marked homestead carries no notice.',
    'The Lien desk still holds every homestead for your attorney. This change is the paper only.',
  ],
}

export default note
