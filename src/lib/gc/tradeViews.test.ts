import { describe, expect, it } from 'vitest'
import { benchAnchor } from './tradeViews'

describe('the dev views’ shared rules', () => {
  it('a trade card’s id is the trade in lower case with dashes', () => {
    expect(benchAnchor('Fire sprinkler')).toBe('gc-bench-fire-sprinkler')
    expect(benchAnchor('HVAC / Controls')).toBe('gc-bench-hvac-controls')
  })
})
