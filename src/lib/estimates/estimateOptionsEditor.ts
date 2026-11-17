/**
 * The estimate editor's option moves (punch list #46 row 3, the Estimates map's Stage-A row 3).
 *
 * While an estimate offers options, the editor works on one of them at a time: `lines` holds the
 * VIEWED option's lines, live, and the option's own `line_items` lags until a move folds them back.
 * These are the moves, as pure steps over the four pieces of state they share. The page sets each
 * piece from the answer; a piece a move does not touch comes back as the same reference.
 *
 * They decide which lines each option saves, so they are tested here and not in a render.
 */
import type { EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import { defaultDraftFirstLine } from './estimateDraftLines'
import {
  MAX_ESTIMATE_OPTIONS,
  defaultEstimateSelection,
  newEstimateOptionKey,
  recommendedEstimateOption,
  setEstimateOptionKind,
  type EstimateOption,
  type EstimateOptionKind,
} from './estimateOptions'

export interface EstimateOptionsEditorState {
  /** The row's options; empty is a plain single-price estimate. The viewed one's `line_items` may be stale. */
  options: EstimateOption[]
  viewedKey: string | null
  /** The viewed option's lines as typed (or the whole estimate's, with no options). */
  lines: EstimateLineItemNormalized[]
  /** The staff Page preview's own selection, rehearsing the customer's picker. */
  previewSelected: string[]
}

export interface EstimateOptionsEditorDeps {
  newKey: () => string
  /** The line an option with no lines opens on. */
  stubLine: () => EstimateLineItemNormalized
}

const defaultDeps: EstimateOptionsEditorDeps = { newKey: newEstimateOptionKey, stubLine: defaultDraftFirstLine }

/** The options with the viewed one's lines kept live: what the cards, the save and the previews read. */
export function syncedEstimateOptionsOf(state: Pick<EstimateOptionsEditorState, 'options' | 'viewedKey' | 'lines'>): EstimateOption[] {
  return state.options.map((o) => (o.key === state.viewedKey ? { ...o, line_items: state.lines } : o))
}

/** An option's lines as the editor opens them: its own, or one stub line when it has none. */
function editorLinesOf(option: EstimateOption, deps: EstimateOptionsEditorDeps): EstimateLineItemNormalized[] {
  return option.line_items.length > 0 ? option.line_items : [deps.stubLine()]
}

/** View another option: the live lines fold into the one being left, then the target's load. */
export function switchViewedEstimateOption(state: EstimateOptionsEditorState, key: string, deps: EstimateOptionsEditorDeps = defaultDeps): EstimateOptionsEditorState {
  if (key === state.viewedKey) return state
  const target = state.options.find((o) => o.key === key)
  if (!target) return state
  return { ...state, options: syncedEstimateOptionsOf(state), viewedKey: key, lines: editorLinesOf(target, deps) }
}

/**
 * Add an option. The first press turns a single estimate into two: the current lines become
 * Option 1 (recommended) and Option 2 starts as a copy to edit from. After that, a new option
 * copies the viewed one, offered the way its source is (a copy of an add-on is an add-on).
 */
export function addEstimateOptionToEditor(state: EstimateOptionsEditorState, deps: EstimateOptionsEditorDeps = defaultDeps): EstimateOptionsEditorState {
  if (state.options.length >= MAX_ESTIMATE_OPTIONS) return state
  if (state.options.length === 0) {
    const a: EstimateOption = { key: deps.newKey(), name: 'Option 1', description: '', recommended: true, kind: 'choice', line_items: state.lines }
    const b: EstimateOption = { key: deps.newKey(), name: 'Option 2', description: '', recommended: false, kind: 'choice', line_items: state.lines.map((l) => ({ ...l })) }
    return { ...state, options: [a, b], viewedKey: b.key, previewSelected: [a.key] }
  }
  const synced = syncedEstimateOptionsOf(state)
  const src = synced.find((o) => o.key === state.viewedKey) ?? synced[0]
  const next: EstimateOption = {
    key: deps.newKey(),
    name: `Option ${state.options.length + 1}`,
    description: '',
    recommended: false,
    kind: src?.kind ?? 'choice',
    line_items: (src?.line_items ?? []).map((l) => ({ ...l })),
  }
  return { ...state, options: [...synced, next], viewedKey: next.key, lines: editorLinesOf(next, deps) }
}

/**
 * Remove the viewed option. Down to one, the estimate goes back to a single price with that
 * option's lines. Otherwise the star re-seats on the first option when the removed one held it,
 * and the editor views the recommended one.
 */
export function removeViewedEstimateOption(state: EstimateOptionsEditorState, deps: EstimateOptionsEditorDeps = defaultDeps): EstimateOptionsEditorState {
  const remaining = syncedEstimateOptionsOf(state).filter((o) => o.key !== state.viewedKey)
  if (remaining.length <= 1) {
    const only = remaining[0] ?? null
    return { options: [], viewedKey: null, previewSelected: [], lines: only ? editorLinesOf(only, deps) : state.lines }
  }
  const fixed = remaining.some((o) => o.recommended) ? remaining : remaining.map((o, i) => ({ ...o, recommended: i === 0 }))
  const nextViewed = recommendedEstimateOption(fixed)
  return {
    options: fixed,
    viewedKey: nextViewed?.key ?? null,
    previewSelected: defaultEstimateSelection(fixed),
    lines: nextViewed ? editorLinesOf(nextViewed, deps) : state.lines,
  }
}

/** Rename an option or change its pitch. */
export function patchEstimateOption(options: EstimateOption[], key: string | null, patch: Partial<Pick<EstimateOption, 'name' | 'description'>>): EstimateOption[] {
  return options.map((o) => (o.key === key ? { ...o, ...patch } : o))
}

/** Offer the viewed option as a choice or an add-on: the star re-seats itself and the Page preview restarts from the default. */
export function setViewedEstimateOptionKind(state: EstimateOptionsEditorState, kind: EstimateOptionKind): EstimateOptionsEditorState {
  if (!state.viewedKey) return state
  const options = setEstimateOptionKind(state.options, state.viewedKey, kind)
  return { ...state, options, previewSelected: defaultEstimateSelection(options) }
}
