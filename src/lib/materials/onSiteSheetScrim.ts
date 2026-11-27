import type { CSSProperties } from 'react'
import type { VisibleBand } from '../visibleBand'

/**
 * The sheet's scrim (punch list #398). Pinned to the whole page it ignored the keyboard: the simulator's walk of
 * 2026-11-25 had Safari's address pill over **Add 1 and another part** and the keyboard's bar over **Pick a different
 * part**. Given the band that shows, it starts where the band starts and is as tall, as `PhoneSheet`'s backdrop is,
 * so every sheet of the On site tab ends at the top of the keys. With no band, a desk or a browser that cannot say,
 * it keeps the page box.
 */
export function onSiteSheetScrim(band: VisibleBand | null): CSSProperties {
  const look: CSSProperties = { zIndex: 800, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end' }
  return band
    ? { ...look, position: 'fixed', top: band.top, left: 0, right: 0, height: band.height, paddingTop: 'var(--app-top-chrome, 0px)' }
    : { ...look, position: 'fixed', inset: 0, paddingTop: 'var(--app-top-chrome, 0px)' }
}

/**
 * A short room (finding 310, the simulator's looks of 2026-11-27). With the number pad up a 375 by 667 phone shows
 * about 320 px, and the Add a part sheet's quantity step is 339 px from its head through its chips to the blue press.
 * The sheet also kept to 90% of the room. So **+10**, **+25** and **+100** stood under the fold, a scroll away.
 *
 * Under `ON_SITE_SHEET_TIGHT_PX` of room the sheet gives up what is not the work, in `onSiteSheetFit`: the strip of
 * scrim over it, its drag handle, and some of its padding. The number is the keyboard's own measure for a thread
 * (`THREAD_TIGHT_BAND_PX`): under it the keys are up, on any phone.
 */
export const ON_SITE_SHEET_TIGHT_PX = 480

/** The keys are up: little of the page shows on a phone. A desk, and a browser that cannot say, are never tight. */
export function onSiteSheetTight(band: VisibleBand | null): boolean {
  return band != null && band.height < ON_SITE_SHEET_TIGHT_PX
}

export interface OnSiteSheetFit {
  /** How much of the room the sheet may take. */
  maxHeight: string
  /** The drag handle over the title: decoration, and a sheet that fills the room has nowhere to be dragged. */
  handle: boolean
  headPad: string
  bodyPad: string
  bodyGap: string
  /** The foot's padding over and under its press. The phone's own safe area is added to the second by the sheet. */
  footPadTop: string
  footPadBottom: string
  /** The height of the number's field in the Add a part stepper: its − and + are 56, and loose it stood 69. */
  stepperField: number | null
}

const LOOSE_FIT: OnSiteSheetFit = { maxHeight: '90%', handle: true, headPad: '0.6rem 1rem 0', bodyPad: '0.6rem 1rem 1rem', bodyGap: '0.75rem', footPadTop: '0.6rem', footPadBottom: '0.75rem', stepperField: null }
const TIGHT_FIT: OnSiteSheetFit = { maxHeight: '100%', handle: false, headPad: '0.6rem 1rem 0', bodyPad: '0.4rem 1rem 0.75rem', bodyGap: '0.5rem', footPadTop: '0.4rem', footPadBottom: '0.5rem', stepperField: 56 }

/** What the sheet draws for the room it has. */
export function onSiteSheetFit(tight: boolean): OnSiteSheetFit {
  return tight ? TIGHT_FIT : LOOSE_FIT
}

/**
 * The sheet's surface, carried on under its foot (finding 310). The room a phone reports ends over Safari's own
 * address pill, which floats above the keys, and the page behind showed through around it: a part's row under the
 * sheet's blue press. This fills from the room's foot down, so the sheet reads as standing on the keys. A press on it does
 * nothing: it hides rows of the page, and a press must not land on a row nobody can see. Drawn only where the sheet
 * follows the room.
 */
export function onSiteSheetTail(band: VisibleBand | null): CSSProperties | null {
  if (!band) return null
  return { position: 'absolute', top: '100%', left: 0, right: 0, height: '100vh', background: 'var(--surface)' }
}
