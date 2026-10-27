import { describe, expect, it } from 'vitest'
import { parseSelect, splitTop } from './select'

describe('the select grammar', () => {
  it('splits on top-level commas only', () => {
    expect(splitTop('a,b(c,d),"e,f"')).toEqual(['a', 'b(c,d)', '"e,f"'])
  })

  it('reads columns, aliases, casts, JSON paths, embeds with hints, spreads and counts', () => {
    expect(parseSelect('id, total:amount::int, src:meta->a->>b, owner:customers!jobs_customer_id_fkey!inner(name), ...people(name), jobs(count), count()')).toEqual([
      { kind: 'col', name: 'id', alias: undefined, path: [], cast: undefined },
      { kind: 'col', name: 'amount', alias: 'total', path: [], cast: 'int' },
      { kind: 'col', name: 'meta', alias: 'src', path: [{ op: '->', key: 'a' }, { op: '->>', key: 'b' }], cast: undefined },
      { kind: 'embed', name: 'customers', alias: 'owner', hint: 'jobs_customer_id_fkey', inner: true, spread: false, children: [{ kind: 'col', name: 'name', alias: undefined, path: [], cast: undefined }] },
      { kind: 'embed', name: 'people', alias: undefined, hint: undefined, inner: false, spread: true, children: [{ kind: 'col', name: 'name', alias: undefined, path: [], cast: undefined }] },
      { kind: 'embed', name: 'jobs', alias: undefined, hint: undefined, inner: false, spread: false, children: [{ kind: 'col', name: 'count', alias: undefined, path: [], cast: undefined }] },
      { kind: 'count', alias: undefined },
    ])
  })

  it('reads a missing or empty select as every column', () => {
    expect(parseSelect(null)).toEqual([{ kind: 'star' }])
    expect(parseSelect('')).toEqual([{ kind: 'star' }])
  })

  it('names what it cannot read yet', () => {
    expect(() => parseSelect('amount.sum()')).toThrow(/cannot read this request yet: an aggregate/)
  })
})
