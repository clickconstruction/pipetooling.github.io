import { describe, expect, it } from 'vitest'
import { finalCameInDraft, finalCameInMissing, finalCameInPayload, signedFileArgs, type FinalCameIn } from './closeoutRows'
import { partnerById } from './lookups'
import { initialGcState } from './schedule/testState'

const state = initialGcState()
const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
const site = fairOaks.packages.find((k) => k.id === 'fsite')!
const partnerOf = (inviteId: string | null | undefined) => {
  const partnerId = site.invites.find((i) => i.id === inviteId)?.partnerId
  return partnerId ? partnerById(state, partnerId)! : undefined
}

describe('finalCameInDraft', () => {
  it('starts from the words of their newest pay application, with no period and no file', () => {
    const partner = partnerOf(site.awardedInviteId)!
    const d = finalCameInDraft('fsite', site.sow!, partner)
    const newest = [...site.sow!.draws].sort((a, b) => b.number - a.number).find((x) => x.payApp?.signedBy)?.payApp
    expect(d.packageId).toBe('fsite')
    expect(d.periodTo).toBe('')
    expect(d.fileName).toBe('')
    expect(d.driveUrl).toBe('')
    expect('lines' in d).toBe(false)
    if (newest) expect(d.signedBy).toBe(newest.signedBy)
  })
})

const filled: FinalCameIn = {
  packageId: 'fsite',
  periodTo: '2026-10-09',
  address: '  1200 Loop 1604, San Antonio  ',
  license: ' ',
  signedBy: ' Ray Ochoa ',
  signedTitle: 'Owner ',
  fileName: '',
  driveUrl: '  ',
}

describe('finalCameInMissing', () => {
  it('asks for the day it runs to, then who signed it, then nothing', () => {
    expect(finalCameInMissing({ ...filled, periodTo: '' })).toBe('Say the day it runs to first.')
    expect(finalCameInMissing({ ...filled, signedBy: '  ' })).toBe('Say who signed it first.')
    expect(finalCameInMissing(filled)).toBeNull()
  })
})

describe('finalCameInPayload', () => {
  it('trims the words and sends the file and its link only when given', () => {
    expect(finalCameInPayload(filled)).toEqual({ periodTo: '2026-10-09', address: '1200 Loop 1604, San Antonio', license: '', signedBy: 'Ray Ochoa', signedTitle: 'Owner' })
    expect(finalCameInPayload({ ...filled, fileName: ' final.pdf ', driveUrl: 'https://drive.google.com/file/d/x' })).toMatchObject({ fileName: 'final.pdf', driveUrl: 'https://drive.google.com/file/d/x' })
  })
})

describe('signedFileArgs', () => {
  it('names the file and its link for the function only when given', () => {
    expect(signedFileArgs({ fileName: '', driveUrl: ' ' })).toEqual({})
    expect(signedFileArgs({ fileName: ' CO 4 signed.pdf ', driveUrl: 'https://drive.google.com/file/d/y' })).toEqual({ p_file_name: 'CO 4 signed.pdf', p_drive_url: 'https://drive.google.com/file/d/y' })
  })
})
