import { describe, expect, it } from 'vitest'
import { stageOffersHazmatFee, type HazmatFeeBoardStage } from './hazmatFeeStages'

describe('stageOffersHazmatFee', () => {
  it('offers the fee on the three stages before the bill goes out', () => {
    const offering: HazmatFeeBoardStage[] = ['waiting', 'working', 'readyToBill']
    for (const stage of offering) expect(stageOffersHazmatFee(stage)).toBe(true)
  })

  it('holds it back once the job is billed, chased, given up on or paid', () => {
    const held: HazmatFeeBoardStage[] = ['billed', 'collections', 'uncollectible', 'paid']
    for (const stage of held) expect(stageOffersHazmatFee(stage)).toBe(false)
  })
})
