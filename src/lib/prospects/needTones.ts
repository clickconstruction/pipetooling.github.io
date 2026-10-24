/**
 * The needs panel's tones as theme tokens (v2.5808): the page's `NEED_TONE_COLOR`, lifted so the
 * board's column heads read the same reds and ambers. Pure.
 */
import type { NeedTone } from './gcNeeds'

export const NEED_TONE_COLOR_BY_NAME: Record<NeedTone | string, string> = {
  red: 'var(--text-red-700)',
  amber: 'var(--text-amber-700)',
  green: 'var(--text-green-700)',
  quiet: 'var(--text-600)',
}
