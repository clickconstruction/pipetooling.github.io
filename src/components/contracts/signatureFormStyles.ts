/**
 * The sizes a signing form's presses are drawn at (v2.8294).
 *
 * A customer signs on a phone. The form's own presses were its smallest: the box a signer must tick was the
 * browser's own 13 px square, **Type** and **Draw** stood 32 px, and the button that signs stood 34 px. These are
 * the sizes for a thumb, shared by the signing form and the consent line under it so the two ticks match.
 */
import type { CSSProperties } from 'react'

/** A press on a signing form is at least this tall. */
export const SIGN_PRESS_MIN_HEIGHT = 44

/** The row of a box a signer must tick: the whole row is the press, a thumb tall, the words beside the box. */
export const SIGN_TICK_ROW: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', textAlign: 'left', minHeight: SIGN_PRESS_MIN_HEIGHT, padding: '0.6rem 0', boxSizing: 'border-box', cursor: 'pointer' }

/** The box itself: big enough to see whether it is ticked. It keeps its place at the top of its words. */
export const SIGN_TICK_BOX: CSSProperties = { width: 22, height: 22, flex: '0 0 auto', margin: 0 }

/**
 * A link inside a sentence, such as a phone number or *How electronic signing works*. Its words stay where they
 * are: the padding grows what a thumb can hit above and below the line, and the margin takes the same back so
 * the line does not move. A link ignores the margin and never needed it. A button is a box on its line, and
 * without the margin its padding pushed the line 24 px down, which the first look at the agreement showed.
 */
export const INLINE_THUMB_PAD: CSSProperties = { paddingTop: 12, paddingBottom: 12, marginTop: -12, marginBottom: -12 }
