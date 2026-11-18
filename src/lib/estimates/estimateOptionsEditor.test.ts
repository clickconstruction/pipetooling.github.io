import { describe, expect, it } from 'vitest'
import type { EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import { MAX_ESTIMATE_OPTIONS, type EstimateOption } from './estimateOptions'
import {
  addEstimateOptionToEditor,
  patchEstimateOption,
  removeViewedEstimateOption,
  setViewedEstimateOptionKind,
  switchViewedEstimateOption,
  syncedEstimateOptionsOf,
  type EstimateOptionsEditorDeps,
  type EstimateOptionsEditorState,
} from './estimateOptionsEditor'

function line(name: string, cents: number): EstimateLineItemNormalized {
  return { line_item: name, description: '', quantity: 1, unit_price_cents: cents, amount_cents: cents }
}
const STUB = line('stub', 0)

/** Keys come out k1, k2, … so a test can name them. */
function deps(): EstimateOptionsEditorDeps {
  let n = 0
  return { newKey: () => `k${++n}`, stubLine: () => STUB }
}

function option(key: string, over: Partial<EstimateOption> = {}): EstimateOption {
  return { key, name: key, description: '', recommended: false, kind: 'choice', line_items: [line(`${key} line`, 100)], ...over }
}

/** Two choices, A starred and viewed, with A's lines edited since it was last folded. */
function twoOptions(): EstimateOptionsEditorState {
  return {
    options: [option('A', { recommended: true, line_items: [line('A as saved', 100)] }), option('B')],
    viewedKey: 'A',
    lines: [line('A as typed', 250)],
    previewSelected: ['A'],
  }
}

describe('syncedEstimateOptionsOf', () => {
  it('puts the live lines on the viewed option and leaves the others', () => {
    const s = twoOptions()
    const synced = syncedEstimateOptionsOf(s)
    expect(synced[0]!.line_items).toBe(s.lines)
    expect(synced[1]).toBe(s.options[1])
  })
})

describe('switchViewedEstimateOption', () => {
  it('folds the typed lines into the option being left, then loads the target’s', () => {
    const s = twoOptions()
    const next = switchViewedEstimateOption(s, 'B', deps())
    expect(next.viewedKey).toBe('B')
    expect(next.options[0]!.line_items).toEqual([line('A as typed', 250)])
    expect(next.lines).toBe(s.options[1]!.line_items)
    expect(next.previewSelected).toBe(s.previewSelected)
  })

  it('opens an option with no lines on the stub line', () => {
    const s = twoOptions()
    s.options[1] = option('B', { line_items: [] })
    expect(switchViewedEstimateOption(s, 'B', deps()).lines).toEqual([STUB])
  })

  it('changes nothing for the option already viewed or a key that is not there', () => {
    const s = twoOptions()
    expect(switchViewedEstimateOption(s, 'A', deps())).toBe(s)
    expect(switchViewedEstimateOption(s, 'nope', deps())).toBe(s)
  })
})

describe('addEstimateOptionToEditor', () => {
  it('turns a single estimate into two on the first press: the lines become Option 1, starred, and Option 2 is a copy', () => {
    const s: EstimateOptionsEditorState = { options: [], viewedKey: null, lines: [line('heater', 900)], previewSelected: [] }
    const next = addEstimateOptionToEditor(s, deps())
    expect(next.options.map((o) => [o.key, o.name, o.recommended, o.kind])).toEqual([
      ['k1', 'Option 1', true, 'choice'],
      ['k2', 'Option 2', false, 'choice'],
    ])
    expect(next.viewedKey).toBe('k2')
    expect(next.previewSelected).toEqual(['k1'])
    // The editor keeps the lines it had; Option 2's are an equal copy, not the same objects.
    expect(next.lines).toBe(s.lines)
    expect(next.options[0]!.line_items).toBe(s.lines)
    expect(next.options[1]!.line_items).toEqual(s.lines)
    expect(next.options[1]!.line_items[0]).not.toBe(s.lines[0])
  })

  it('copies the viewed option with its typed lines, and views the copy', () => {
    const s = twoOptions()
    const next = addEstimateOptionToEditor(s, deps())
    expect(next.options).toHaveLength(3)
    expect(next.options[2]).toMatchObject({ key: 'k1', name: 'Option 3', recommended: false, kind: 'choice' })
    expect(next.options[2]!.line_items).toEqual([line('A as typed', 250)])
    expect(next.options[2]!.line_items[0]).not.toBe(s.lines[0])
    // The option being left keeps what was typed.
    expect(next.options[0]!.line_items).toEqual([line('A as typed', 250)])
    expect(next.viewedKey).toBe('k1')
    expect(next.lines).toBe(next.options[2]!.line_items)
    expect(next.previewSelected).toBe(s.previewSelected)
  })

  it('offers a copy the way its source is: a copy of an add-on is an add-on', () => {
    const s = twoOptions()
    s.options[0] = option('A', { kind: 'add_on' })
    expect(addEstimateOptionToEditor(s, deps()).options[2]!.kind).toBe('add_on')
  })

  it('opens a copy of an option with no lines on the stub line', () => {
    const s = twoOptions()
    s.lines = []
    const next = addEstimateOptionToEditor(s, deps())
    expect(next.options[2]!.line_items).toEqual([])
    expect(next.lines).toEqual([STUB])
  })

  it('stops at the cap', () => {
    const s: EstimateOptionsEditorState = {
      options: Array.from({ length: MAX_ESTIMATE_OPTIONS }, (_, i) => option(`o${i}`, { recommended: i === 0 })),
      viewedKey: 'o0',
      lines: [],
      previewSelected: ['o0'],
    }
    expect(addEstimateOptionToEditor(s, deps())).toBe(s)
  })
})

describe('removeViewedEstimateOption', () => {
  it('goes back to a single price when one option is left, with that option’s lines', () => {
    const s = twoOptions()
    const next = removeViewedEstimateOption(s, deps())
    expect(next).toEqual({ options: [], viewedKey: null, previewSelected: [], lines: [line('B line', 100)] })
  })

  it('keeps the typed lines of the option that stays when the other is removed', () => {
    const s = twoOptions()
    // View B, remove it: A stays, with what was typed into B gone and A's own lines back.
    const onB = switchViewedEstimateOption(s, 'B', deps())
    const next = removeViewedEstimateOption(onB, deps())
    expect(next.options).toEqual([])
    expect(next.lines).toEqual([line('A as typed', 250)])
  })

  it('opens the stub line when the option that stays has no lines', () => {
    const s = twoOptions()
    s.options[1] = option('B', { line_items: [] })
    expect(removeViewedEstimateOption(s, deps()).lines).toEqual([STUB])
  })

  it('re-seats the star on the first option when the starred one is removed, and views it', () => {
    const s: EstimateOptionsEditorState = {
      options: [option('A', { recommended: true }), option('B'), option('C')],
      viewedKey: 'A',
      lines: [line('A typed', 1)],
      previewSelected: ['A'],
    }
    const next = removeViewedEstimateOption(s, deps())
    expect(next.options.map((o) => [o.key, o.recommended])).toEqual([
      ['B', true],
      ['C', false],
    ])
    expect(next.viewedKey).toBe('B')
    expect(next.previewSelected).toEqual(['B'])
    expect(next.lines).toEqual([line('B line', 100)])
  })

  it('leaves the star where it is when another option is removed, and views the starred one', () => {
    const s: EstimateOptionsEditorState = {
      options: [option('A', { recommended: true }), option('B'), option('C')],
      viewedKey: 'C',
      lines: [line('C typed', 1)],
      previewSelected: ['A'],
    }
    const next = removeViewedEstimateOption(s, deps())
    expect(next.options.map((o) => o.key)).toEqual(['A', 'B'])
    expect(next.viewedKey).toBe('A')
    expect(next.lines).toEqual([line('A line', 100)])
  })
})

describe('patchEstimateOption', () => {
  it('renames only the option named', () => {
    const options = [option('A'), option('B')]
    const next = patchEstimateOption(options, 'B', { name: 'Tankless' })
    expect(next[0]).toBe(options[0])
    expect(next[1]).toMatchObject({ key: 'B', name: 'Tankless' })
  })

  it('changes nothing with no option viewed', () => {
    const options = [option('A')]
    expect(patchEstimateOption(options, null, { description: 'x' })).toEqual(options)
  })
})

describe('setViewedEstimateOptionKind', () => {
  it('offers the viewed option as an add-on and restarts the preview from the default', () => {
    const s = twoOptions()
    const onB = switchViewedEstimateOption(s, 'B', deps())
    const next = setViewedEstimateOptionKind({ ...onB, previewSelected: ['B'] }, 'add_on')
    expect(next.options[1]!.kind).toBe('add_on')
    expect(next.previewSelected).toEqual(['A'])
    expect(next.lines).toBe(onB.lines)
    expect(next.viewedKey).toBe('B')
  })

  it('moves the star off an option that becomes an add-on while a choice remains', () => {
    const next = setViewedEstimateOptionKind(twoOptions(), 'add_on')
    expect(next.options.map((o) => [o.key, o.kind, o.recommended])).toEqual([
      ['A', 'add_on', false],
      ['B', 'choice', true],
    ])
    expect(next.previewSelected).toEqual(['B'])
  })

  it('changes nothing with no option viewed', () => {
    const s: EstimateOptionsEditorState = { options: [], viewedKey: null, lines: [], previewSelected: [] }
    expect(setViewedEstimateOptionKind(s, 'add_on')).toBe(s)
  })
})
