import { describe, expect, it } from 'vitest'
import { dashAfterTokenLength, isJobDoorLink, splitJobLinkLabel } from './checklistJobChip'

describe('checklistJobChip (v2.3769)', () => {
  it('recognises a job door, absolute or relative, and nothing else', () => {
    expect(isJobDoorLink('https://clicktooling.com/jobs?jobDetail=0060850d-ab27')).toBe(true)
    expect(isJobDoorLink('/jobs?jobDetail=0060850d-ab27')).toBe(true)
    expect(isJobDoorLink('http://127.0.0.1:5193/jobs?jobDetail=abc&tab=stages')).toBe(true)
    // the vehicle marker's link, a drive link, the jobs page without a job, blanks
    expect(isJobDoorLink('https://clicktooling.com/people?tab=vehicles')).toBe(false)
    expect(isJobDoorLink('https://drive.google.com/x')).toBe(false)
    expect(isJobDoorLink('/jobs?tab=stages')).toBe(false)
    expect(isJobDoorLink('/jobs?jobDetail=')).toBe(false)
    expect(isJobDoorLink('')).toBe(false)
    expect(isJobDoorLink(null)).toBe(false)
  })

  it('splits the label into the number badge and the name', () => {
    expect(splitJobLinkLabel('1016 · Mission faucet')).toEqual({ number: '1016', name: 'Mission faucet' })
    expect(splitJobLinkLabel('C42 · Coe pool & windows')).toEqual({ number: 'C42', name: 'Coe pool & windows' })
    expect(splitJobLinkLabel('— · Job')).toEqual({ number: null, name: 'Job' })
    expect(splitJobLinkLabel('Just a name')).toEqual({ number: null, name: 'Just a name' })
  })

  it('measures the dash after the token so the display can drop it, and only a dash', () => {
    expect(dashAfterTokenLength(' — Pick up the cartridge')).toBe(3)
    expect(dashAfterTokenLength(' - Pick up')).toBe(3)
    expect(dashAfterTokenLength('— Pick up')).toBe(2)
    expect(dashAfterTokenLength(' Pick up')).toBe(0)
    expect(dashAfterTokenLength('')).toBe(0)
  })
})
