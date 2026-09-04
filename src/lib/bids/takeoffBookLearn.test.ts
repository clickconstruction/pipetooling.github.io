import { describe, expect, it } from 'vitest'
import { nextBookAssemblyName, planRememberForBook } from './takeoffBookLearn'

describe('nextBookAssemblyName', () => {
  it('names the assembly after the key and numbers siblings instead of overwriting', () => {
    expect(nextBookAssemblyName('wc', [])).toBe('wc · book')
    expect(nextBookAssemblyName('wc', ['WC · Book'])).toBe('wc · book 2')
    expect(nextBookAssemblyName('wc', ['wc · book', 'wc · book 2'])).toBe('wc · book 3')
  })
})

describe('planRememberForBook', () => {
  const entries = [{ id: 'e-wc', fixture_name: 'wc', alias_names: ['toilet'] }]

  it('does nothing for a blank fixture or a fixture with no lines', () => {
    expect(planRememberForBook({ fixture: ' ', lines: [{ partId: 'p', quantity: 1, sourceTemplateId: null }], existingEntries: [], existingAssemblyNames: [] })).toEqual({ kind: 'nothing', reason: 'no-fixture' })
    expect(planRememberForBook({ fixture: 'wc', lines: [], existingEntries: [], existingAssemblyNames: [] })).toEqual({ kind: 'nothing', reason: 'no-lines' })
  })

  it('merges part lines into one new assembly and creates an entry when none answers', () => {
    const plan = planRememberForBook({
      fixture: 'S-1',
      lines: [
        { partId: 'sink', quantity: 1, sourceTemplateId: null },
        { partId: 'stop', quantity: 2, sourceTemplateId: null },
        { partId: 'stop', quantity: 1, sourceTemplateId: 'expanded-from' },
      ],
      existingEntries: entries,
      existingAssemblyNames: [],
    })
    expect(plan).toMatchObject({
      kind: 'remember',
      key: 's',
      templateIdsToLink: [],
      newAssembly: { name: 's · book', items: [{ part_id: 'sink', quantity: 1 }, { part_id: 'stop', quantity: 3 }] },
      entry: { action: 'create', fixtureName: 's' },
    })
  })

  it('adds the plan-tag form as an alias when an entry answers to the key but not the exact name', () => {
    const plan = planRememberForBook({ fixture: 'WC-12', lines: [{ partId: 'p', quantity: 1, sourceTemplateId: null }], existingEntries: entries, existingAssemblyNames: ['wc · book'] })
    expect(plan).toMatchObject({ kind: 'remember', entry: { action: 'alias', entryId: 'e-wc', alias: 'wc-12' }, newAssembly: { name: 'wc · book 2' } })
  })

  it('touches no entry when the exact name already answers, and links bundles as their own template', () => {
    const plan = planRememberForBook({
      fixture: 'Toilet',
      lines: [{ partId: null, quantity: 1, sourceTemplateId: 't-bundle' }, { partId: null, quantity: 1, sourceTemplateId: 't-bundle' }],
      existingEntries: entries,
      existingAssemblyNames: [],
    })
    expect(plan).toMatchObject({ kind: 'remember', key: 'toilet', templateIdsToLink: ['t-bundle'], newAssembly: null, entry: { action: 'none', entryId: 'e-wc' } })
  })
})
