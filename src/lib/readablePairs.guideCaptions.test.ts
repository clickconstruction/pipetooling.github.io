import { describe, expect, it } from 'vitest'
import { GUIDE_CAPTION_INK, GUIDE_DEAD_BUTTON, GUIDE_PANEL_GROUND } from './helpGuideIllustrations'
import { contrastRatio } from './lens/lensAudit'
import { hexToRgba } from './lens/lensTokens'

/**
 * A guide's Example caption on its light panel and the grey mock button's words (v2.6085). The panel is
 * drawn light in both themes, so each pair is one number. Its own file so the sweep's PRs queue together
 * without sharing a line; the pins move into readablePairs.test.ts once every one is on main.
 */
const ratio = (fg: string, bg: string) => contrastRatio(hexToRgba(fg), hexToRgba(bg))

describe("a guide's Example panel (v2.6085)", () => {
  it("the caption on the panel: 4.5:1 or better", () => {
    expect(ratio(GUIDE_CAPTION_INK, GUIDE_PANEL_GROUND)).toBeGreaterThanOrEqual(4.5)
  })
  it('the grey mock button: 4.5:1 or better', () => {
    expect(ratio(GUIDE_DEAD_BUTTON.ink, GUIDE_DEAD_BUTTON.fill)).toBeGreaterThanOrEqual(4.5)
  })
})
