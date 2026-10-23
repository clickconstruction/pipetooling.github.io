/**
 * The robot's ring in a help guide (v2.5747): a guide writes `:::ring` and `:::`, the renderer draws the seven
 * segments the Bid Board's ring fills (`helpGuideIllustrations.ts`), and a press on Next step or Start over moves it
 * here. `ringState` is the pure half: what the ring says and shows after `at` steps. `stepHelpRing` applies it to the
 * drawn ring, which GuideBrowser calls from its one click handler.
 */
import { HEARTBEAT_STEPS, HEARTBEAT_STEP_WORDS, type HeartbeatStep } from '../../supabase/functions/_shared/twinHeartbeat'

/** What each step means, in the reader's words (plain words). */
export const RING_STEP_SUB: Record<HeartbeatStep, string> = {
  picked_up: 'The robot took the bid. Nothing to read yet.',
  plans: 'It filed the plan set. The Plans button has words now.',
  reading: 'Sheet by sheet. The segment fills by the sheets it has read.',
  counting: 'Fixtures and tie-ins, counted blind.',
  pricing: 'The book prices every count.',
  sealed: 'Its number is sealed. You see it the moment you send.',
  questions: 'What the plans do not say, as questions for you.',
}

export const RING_IDLE_WORD = 'Nothing yet'
export const RING_IDLE_SUB = 'Each tap is one step of the robot’s work. Seven taps is a sealed number.'

export interface RingState {
  at: number
  word: string
  sub: string
  /** One per segment: filled or not. */
  segments: boolean[]
  /** One per chip: done, the one now, or not yet. */
  chips: ('on' | 'now' | '')[]
  nextLabel: string
  done: boolean
}

export const RING_STEPS = HEARTBEAT_STEPS.length

/** The ring after `at` taps, clamped to the seven steps. */
export function ringState(atRaw: number): RingState {
  const at = Math.max(0, Math.min(RING_STEPS, Math.floor(Number.isFinite(atRaw) ? atRaw : 0)))
  const step = at === 0 ? null : HEARTBEAT_STEPS[at - 1]!
  return {
    at,
    word: step ? HEARTBEAT_STEP_WORDS[step] : RING_IDLE_WORD,
    sub: step ? RING_STEP_SUB[step] : RING_IDLE_SUB,
    segments: HEARTBEAT_STEPS.map((_, i) => i < at),
    chips: HEARTBEAT_STEPS.map((_, i) => (i < at - 1 ? 'on' : i === at - 1 ? 'now' : '')),
    nextLabel: at >= RING_STEPS ? 'Done' : 'Next step',
    done: at >= RING_STEPS,
  }
}

/** The next state for a press: one more step, or back to the start. */
export function ringAfter(at: number, action: 'next' | 'reset'): number {
  if (action === 'reset') return 0
  return Math.min(RING_STEPS, at + 1)
}

/** Apply a press to a drawn ring (`.help-ring[data-at]`); answers the new `at`. */
export function stepHelpRing(ring: Element, action: 'next' | 'reset'): number {
  const at = ringAfter(parseInt(ring.getAttribute('data-at') ?? '0', 10) || 0, action)
  const state = ringState(at)
  ring.setAttribute('data-at', String(state.at))
  ring.querySelectorAll<Element>('.help-ring-seg').forEach((seg, i) => seg.classList.toggle('on', state.segments[i] === true))
  ring.querySelectorAll<Element>('.help-ring-steps li').forEach((chip, i) => {
    chip.classList.toggle('on', state.chips[i] === 'on')
    chip.classList.toggle('now', state.chips[i] === 'now')
  })
  const word = ring.querySelector('[data-ring-word]')
  if (word) word.textContent = state.word
  const sub = ring.querySelector('[data-ring-sub]')
  if (sub) sub.textContent = state.sub
  const next = ring.querySelector<HTMLButtonElement>('button[data-help-ring="next"]')
  if (next) {
    next.textContent = state.nextLabel
    next.disabled = state.done
  }
  return state.at
}
