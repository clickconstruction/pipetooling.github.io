import { describe, expect, it } from 'vitest'
import { lienDeskFromSearch } from '../lien/lienDeskRoute'
import { legalPaperNextDoor, legalPaperNextDoorHref } from './legalPaperNextDoor'

describe('legalPaperNextDoor — the Legal desk’s door to the next lien step (v2.6104)', () => {
  it('a notice or the retainage notice opens the Lien desk, where they are drafted and sent', () => {
    expect(legalPaperNextDoor({ kind: 'notice' })).toEqual({ label: 'Draft the notice…', to: 'desk', kind: 'notice' })
    expect(legalPaperNextDoor({ kind: 'late_notice' })).toEqual({ label: 'Draft the notice…', to: 'desk', kind: 'notice' })
    expect(legalPaperNextDoor({ kind: 'retainage' })).toEqual({ label: 'Draft the retainage notice…', to: 'desk', kind: 'retainage' })
  })

  it('the affidavit, its service and the release open the Lien window on their tab', () => {
    expect(legalPaperNextDoor({ kind: 'affidavit' })).toEqual({ label: 'Go to the affidavit…', to: 'window', tab: 'affidavit' })
    expect(legalPaperNextDoor({ kind: 'serve' })).toEqual({ label: 'Enter mail numbers…', to: 'window', tab: 'affidavit' })
    expect(legalPaperNextDoor({ kind: 'release' })).toEqual({ label: 'Record the release…', to: 'window', tab: 'release_record' })
  })

  it('draws no button when the next step is nobody’s press from the desk', () => {
    expect(legalPaperNextDoor({ kind: 'suit' })).toBeNull()
    expect(legalPaperNextDoor({ kind: 'lien_gone' })).toBeNull()
    expect(legalPaperNextDoor({ kind: 'none' })).toBeNull()
  })
})

describe('legalPaperNextDoorHref — where a door goes (v2.8498)', () => {
  /** What the Lien desk reads from a door's address. */
  const deskReads = (href: string) => {
    const [path, search] = href.split('?')
    const { kind, job } = lienDeskFromSearch(new URLSearchParams(search ?? ''))
    return { path, kind, job }
  }

  it('each notice opens its own list of the Lien desk, on the job', () => {
    for (const kind of ['notice', 'late_notice'] as const) {
      expect(deskReads(legalPaperNextDoorHref('job-a', legalPaperNextDoor({ kind })))).toEqual({ path: '/lien-desk', kind: 'notice', job: 'job-a' })
    }
    // The retainage notice went to Monthly notices before, a list the job is not on.
    expect(deskReads(legalPaperNextDoorHref('job-a', legalPaperNextDoor({ kind: 'retainage' })))).toEqual({ path: '/lien-desk', kind: 'retainage', job: 'job-a' })
    expect(legalPaperNextDoorHref('job-a', legalPaperNextDoor({ kind: 'retainage' }))).toBe('/lien-desk?tab=retainage&job=job-a')
  })

  it('a window door opens the job’s Lien window on its tab, word for word as before', () => {
    expect(legalPaperNextDoorHref('job-a', legalPaperNextDoor({ kind: 'affidavit' }))).toBe('/jobs?tab=stages&lienwindow=job-a&lientab=affidavit')
    expect(legalPaperNextDoorHref('job-a', legalPaperNextDoor({ kind: 'serve' }))).toBe('/jobs?tab=stages&lienwindow=job-a&lientab=affidavit')
    expect(legalPaperNextDoorHref('job-a', legalPaperNextDoor({ kind: 'release' }))).toBe('/jobs?tab=stages&lienwindow=job-a&lientab=release_record')
  })

  it('no door opens the job’s Lien window as it opens, and a job’s id is written safely', () => {
    expect(legalPaperNextDoorHref('job-a')).toBe('/jobs?tab=stages&lienwindow=job-a')
    expect(legalPaperNextDoorHref('job-a', null)).toBe('/jobs?tab=stages&lienwindow=job-a')
    expect(legalPaperNextDoorHref('a b&c')).toBe('/jobs?tab=stages&lienwindow=a%20b%26c')
  })
})
