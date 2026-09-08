import { describe, expect, it } from 'vitest'
import { buildReadinessLine, isProbeableLink, ROBOT_INTAKE_ACCOUNT, type ReadinessLineInputs } from './robotReadinessLine'

const inputs = (over: Partial<ReadinessLineInputs> = {}): ReadinessLineInputs => ({
  plansLink: 'https://drive.google.com/file/d/1abcdefghijklmnopqrstuvwxyz/view',
  address: '12925 FM 20, Kingsbury, TX 78638',
  distanceFromOffice: '42',
  bidDueDate: '2026-09-19',
  serviceTypeName: 'Plumbing',
  serviceTypeId: 'plumbing-id',
  robotOptOut: false,
  probe: { kind: 'readable', note: null },
  ...over,
})

describe('buildReadinessLine', () => {
  it('is ready when the probe passed and the inputs are present, and lists the facts', () => {
    const line = buildReadinessLine(inputs())
    expect(line.tone).toBe('ready')
    expect(line.title).toBe('Robots will shadow this bid within the hour')
    expect(line.detail).toContain('plans readable · plumbing · 42 mi · due 2026-09-19')
    expect(line.gaps).toEqual([])
  })

  it('reads a folder probe note as "folder shared · N PDFs"', () => {
    const line = buildReadinessLine(inputs({ probe: { kind: 'readable', note: 'folder · 3 PDFs, merged on fetch: a.pdf, b.pdf, c.pdf' } }))
    expect(line.detail).toContain('folder shared · 3 PDFs')
  })

  it('opt-out wins over everything', () => {
    const line = buildReadinessLine(inputs({ robotOptOut: true, probe: { kind: 'unreadable', note: 'Drive 404' } }))
    expect(line.tone).toBe('off')
    expect(line.title).toBe('Robots will leave this bid alone')
  })

  it('is idle with no plans link', () => {
    const line = buildReadinessLine(inputs({ plansLink: '   ', probe: { kind: 'idle' } }))
    expect(line.tone).toBe('idle')
    expect(line.gaps.map((g) => g.key)).toEqual(['plans'])
  })

  it('shows checking while the probe is in flight', () => {
    expect(buildReadinessLine(inputs({ probe: { kind: 'checking' } })).tone).toBe('checking')
  })

  it('blocks on an unshared file and offers the intake address', () => {
    const line = buildReadinessLine(inputs({ probe: { kind: 'unreadable', note: 'Drive 404 — the file is not shared with the intake service account (or was moved/deleted)' } }))
    expect(line.tone).toBe('blocked')
    expect(line.title).toBe('Robots can’t open these plans yet')
    expect(line.gaps[0]).toMatchObject({ key: 'plans-unreadable', copyIntake: true })
    expect(line.gaps[0]!.text).toContain(ROBOT_INTAKE_ACCOUNT)
    expect(line.gaps[0]!.text).toContain('This file')
  })

  it('names a folder when the unshared link is a folder', () => {
    const line = buildReadinessLine(inputs({ probe: { kind: 'unreadable', note: 'Drive 404 — the folder is not shared with the intake service account' } }))
    expect(line.gaps[0]!.text).toContain('This folder')
  })

  it('passes a non-sharing probe reason through verbatim without the copy action', () => {
    const line = buildReadinessLine(inputs({ probe: { kind: 'unreadable', note: 'file is message/rfc822, not a PDF — robots take PDF plan sets' } }))
    expect(line.gaps[0]).toMatchObject({ key: 'plans-unreadable', copyIntake: false })
    expect(line.gaps[0]!.text).toContain('not a PDF')
  })

  it('blocks a non-plumbing division even when the plans are readable', () => {
    const line = buildReadinessLine(inputs({ serviceTypeName: 'Electrical', serviceTypeId: 'electrical-id' }))
    expect(line.tone).toBe('blocked')
    expect(line.title).toBe('Robots don’t bid this division')
    expect(line.detail).toContain('this is an electrical bid')
  })

  it('a blank distance with an address is a soft gap on a ready line', () => {
    const line = buildReadinessLine(inputs({ distanceFromOffice: '' }))
    expect(line.tone).toBe('ready')
    expect(line.gaps.map((g) => g.key)).toEqual(['distance'])
    expect(line.detail).toContain('fills itself when you save')
  })

  it('a blank distance with no address says the robot will ask', () => {
    const line = buildReadinessLine(inputs({ distanceFromOffice: '', address: '' }))
    expect(line.tone).toBe('ready')
    expect(line.gaps.map((g) => g.key)).toEqual(['address'])
  })

  it('does not nag about distance while it is being measured', () => {
    const line = buildReadinessLine(inputs({ distanceFromOffice: '', distanceBusy: true }))
    expect(line.gaps).toEqual([])
  })

  it('lists every gap in the detail when blocked', () => {
    const line = buildReadinessLine(inputs({ serviceTypeName: 'HVAC', serviceTypeId: 'hvac', distanceFromOffice: '', probe: { kind: 'unreadable', note: 'Drive 403 — no permission' } }))
    expect(line.gaps.map((g) => g.key)).toEqual(['discipline', 'plans-unreadable', 'distance'])
    expect(line.detail).toContain('plumbing only')
    expect(line.detail).toContain(ROBOT_INTAKE_ACCOUNT)
  })
})

describe('isProbeableLink', () => {
  it('accepts Drive file, folder (with /u/N/), open and uc links; rejects everything else', () => {
    expect(isProbeableLink('https://drive.google.com/file/d/1abc/view')).toBe(true)
    expect(isProbeableLink('https://drive.google.com/drive/folders/1abc')).toBe(true)
    expect(isProbeableLink('https://drive.google.com/drive/u/1/folders/1abc')).toBe(true)
    expect(isProbeableLink('https://drive.google.com/open?id=1abc')).toBe(true)
    expect(isProbeableLink('https://www.dropbox.com/s/x/plans.pdf')).toBe(false)
    expect(isProbeableLink('')).toBe(false)
  })
})
