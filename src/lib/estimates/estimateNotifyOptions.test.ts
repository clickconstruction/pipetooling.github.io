import { describe, expect, it } from 'vitest'
import {
  estimateAcceptNotifySeparatorLabel,
  groupEstimateNotifyOptions,
  type EstimateNotifyGroupEntry,
  type EstimateNotifyUserOption,
} from './estimateNotifyOptions'

const u = (over: Partial<EstimateNotifyUserOption>): EstimateNotifyUserOption => ({
  id: over.id ?? 'id',
  name: over.name ?? 'Name',
  email: over.email ?? 'name@example.com',
  ...(over.role !== undefined ? { role: over.role } : {}),
})

const names = (entries: EstimateNotifyGroupEntry[]) =>
  entries.map((e) => (e.kind === 'separator' ? `| ${e.label ?? ''}`.trim() : e.option.name))

describe('estimateAcceptNotifySeparatorLabel', () => {
  it('captions the group below the divider, and the master bucket gets none', () => {
    expect(estimateAcceptNotifySeparatorLabel('master')).toBeUndefined()
    expect(estimateAcceptNotifySeparatorLabel('assistant')).toBe('Assistants')
    expect(estimateAcceptNotifySeparatorLabel('superintendent')).toBe('Superintendents')
    expect(estimateAcceptNotifySeparatorLabel('rest')).toBe('Everyone else')
  })
})

describe('groupEstimateNotifyOptions', () => {
  it('leaves yourself out', () => {
    const out = groupEstimateNotifyOptions(
      [u({ id: 'me', name: 'Me' }), u({ id: 'other', name: 'Other' })],
      'me',
    )
    expect(names(out)).toEqual(['Other'])
  })

  it('keeps everyone when selfId is null or undefined', () => {
    const opts = [u({ id: 'a', name: 'A' }), u({ id: 'b', name: 'B' })]
    expect(names(groupEstimateNotifyOptions(opts, null))).toEqual(['A', 'B'])
    expect(names(groupEstimateNotifyOptions(opts, undefined))).toEqual(['A', 'B'])
  })

  it('buckets master → assistants (controller included) → superintendents → everyone else', () => {
    const out = groupEstimateNotifyOptions(
      [
        u({ id: '1', name: 'Rest', role: 'technician' as EstimateNotifyUserOption['role'] }),
        u({ id: '2', name: 'Super', role: 'superintendent' as EstimateNotifyUserOption['role'] }),
        u({ id: '3', name: 'Asst', role: 'assistant' as EstimateNotifyUserOption['role'] }),
        u({ id: '4', name: 'Ctrl', role: 'controller' as EstimateNotifyUserOption['role'] }),
        u({ id: '5', name: 'Master', role: 'master_technician' as EstimateNotifyUserOption['role'] }),
        u({ id: '6', name: 'NoRole' }),
      ],
      null,
    )
    expect(names(out)).toEqual([
      'Master',
      '| Assistants',
      'Asst',
      'Ctrl',
      '| Superintendents',
      'Super',
      '| Everyone else',
      'NoRole',
      'Rest',
    ])
  })

  it('sorts each bucket by name, case-insensitively, with — standing in for a blank name', () => {
    const out = groupEstimateNotifyOptions(
      [u({ id: '1', name: 'zed' }), u({ id: '2', name: 'Alice' }), u({ id: '3', name: '  ' })],
      null,
    )
    // '—' sorts before letters in a base-sensitivity compare
    expect(names(out)).toEqual(['  ', 'Alice', 'zed'])
  })

  it('draws no separator before the first non-empty bucket, whichever it is', () => {
    const out = groupEstimateNotifyOptions(
      [u({ id: '1', name: 'Only', role: 'superintendent' as EstimateNotifyUserOption['role'] })],
      null,
    )
    expect(out).toEqual([{ kind: 'option', option: expect.objectContaining({ id: '1' }) }])
  })

  it('skips empty buckets: the separator names the next non-empty one and its id carries both keys', () => {
    const out = groupEstimateNotifyOptions(
      [
        u({ id: '1', name: 'Master', role: 'master_technician' as EstimateNotifyUserOption['role'] }),
        u({ id: '2', name: 'NoRole' }),
      ],
      null,
    )
    expect(out[1]).toEqual({ kind: 'separator', id: 'estimate-notify-sep-master-rest', label: 'Everyone else' })
  })

  it('a separator whose label is undefined carries no label key', () => {
    // masters can never follow another bucket, so no real separator is label-less today;
    // this pins that the shape stays { kind, id } when the label is undefined.
    const out = groupEstimateNotifyOptions(
      [
        u({ id: '1', name: 'Asst', role: 'assistant' as EstimateNotifyUserOption['role'] }),
        u({ id: '2', name: 'Super', role: 'superintendent' as EstimateNotifyUserOption['role'] }),
      ],
      null,
    )
    const sep = out.find((e) => e.kind === 'separator')
    expect(sep && 'label' in sep ? sep.label : undefined).toBe('Superintendents')
  })

  it('returns [] for no options and for only yourself', () => {
    expect(groupEstimateNotifyOptions([], 'me')).toEqual([])
    expect(groupEstimateNotifyOptions([u({ id: 'me' })], 'me')).toEqual([])
  })
})
