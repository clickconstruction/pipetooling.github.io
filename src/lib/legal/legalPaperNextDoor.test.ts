import { describe, expect, it } from 'vitest'
import { legalPaperNextDoor } from './legalPaperNextDoor'

describe('legalPaperNextDoor — the Legal desk’s door to the next lien step (v2.6104)', () => {
  it('a notice or the retainage notice opens the Lien desk, where they are drafted and sent', () => {
    expect(legalPaperNextDoor({ kind: 'notice' })).toEqual({ label: 'Draft the notice…', to: 'desk' })
    expect(legalPaperNextDoor({ kind: 'late_notice' })).toEqual({ label: 'Draft the notice…', to: 'desk' })
    expect(legalPaperNextDoor({ kind: 'retainage' })).toEqual({ label: 'Draft the retainage notice…', to: 'desk' })
  })

  it('the affidavit, its service and the release open the Lien window on their tab', () => {
    expect(legalPaperNextDoor({ kind: 'affidavit' })).toEqual({ label: 'Go to the affidavit…', to: 'window', tab: 'affidavit' })
    expect(legalPaperNextDoor({ kind: 'serve' })).toEqual({ label: 'Record the service…', to: 'window', tab: 'affidavit' })
    expect(legalPaperNextDoor({ kind: 'release' })).toEqual({ label: 'Record the release…', to: 'window', tab: 'release_record' })
  })

  it('draws no button when the next step is nobody’s press from the desk', () => {
    expect(legalPaperNextDoor({ kind: 'suit' })).toBeNull()
    expect(legalPaperNextDoor({ kind: 'lien_gone' })).toBeNull()
    expect(legalPaperNextDoor({ kind: 'none' })).toBeNull()
  })
})
