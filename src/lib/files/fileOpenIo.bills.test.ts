import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The bill's row as the reader's policy answers it, and the signed link the bucket hands back. */
const db = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  error: null as { message: string } | null,
  selected: '' as string,
  signedPath: '' as string,
  signed: { data: { signedUrl: 'https://store.example/signed/bill.pdf' }, error: null } as { data: { signedUrl: string } | null; error: { message: string } | null },
}))
vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: (cols: string) => {
        db.selected = cols
        return { eq: () => ({ maybeSingle: async () => ({ data: db.row, error: db.error }) }) }
      },
    }),
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => {
          db.signedPath = path
          return db.signed
        },
      }),
    },
  },
}))

import { billLinkHref, fileTarget } from './fileOpenIo'

const open = () => fileTarget({ source: 'bills', id: 'inv-1' })

beforeEach(() => {
  db.row = null
  db.error = null
  db.selected = ''
  db.signedPath = ''
  db.signed = { data: { signedUrl: 'https://store.example/signed/bill.pdf' }, error: null }
})

describe('fileTarget for a supply house bill (punch list #179, #431)', () => {
  it('signs our own copy when the row kept one, before any link', async () => {
    db.row = { bill_read: { file: { path: 'bills/house-1/inv-1.pdf' } }, link: 'https://drive.example/file/d/abc/view' }
    expect(await open()).toEqual({ url: 'https://store.example/signed/bill.pdf' })
    expect(db.signedPath).toBe('bills/house-1/inv-1.pdf')
    expect(db.selected).toBe('bill_read, link')
  })

  it('goes to the Drive link pasted on the row when there is no copy of ours', async () => {
    db.row = { bill_read: null, link: 'https://drive.example/file/d/abc/view' }
    expect(await open()).toEqual({ url: 'https://drive.example/file/d/abc/view' })
    expect(db.signedPath).toBe('')
  })

  it('a link typed with no scheme gets one, and a map link is not a bill', async () => {
    db.row = { bill_read: null, link: 'drive.example/file/d/abc' }
    expect(await open()).toEqual({ url: 'https://drive.example/file/d/abc' })
    db.row = { bill_read: null, link: 'https://maps.google.com/?q=the+counter' }
    expect(await open()).toEqual({ problem: 'notHere' })
  })

  it('a bill with no copy and no link is not here', async () => {
    db.row = { bill_read: null, link: null }
    expect(await open()).toEqual({ problem: 'notHere' })
    db.row = { bill_read: { file: {} }, link: '   ' }
    expect(await open()).toEqual({ problem: 'notHere' })
  })

  it('a row the reader may not read is not theirs, and a failed read is not here', async () => {
    expect(await open()).toEqual({ problem: 'notYours' })
    db.error = { message: 'boom' }
    expect(await open()).toEqual({ problem: 'notHere' })
  })

  it('a copy that will not sign is not here, and the link is not tried in its place', async () => {
    db.row = { bill_read: { file: { path: 'bills/house-1/inv-1.pdf' } }, link: 'https://drive.example/file/d/abc/view' }
    db.signed = { data: null, error: { message: 'gone' } }
    expect(await open()).toEqual({ problem: 'notHere' })
  })
})

describe('billLinkHref', () => {
  it('is an http or https address, or nothing', () => {
    expect(billLinkHref('https://drive.example/x')).toBe('https://drive.example/x')
    expect(billLinkHref('drive.example/x')).toBe('https://drive.example/x')
    // A typed scheme that is not the web's is wrapped as a host that leads nowhere, never run.
    expect(billLinkHref('javascript:alert(1)')).toBe('https://javascript:alert(1)')
    expect(billLinkHref('')).toBeNull()
    expect(billLinkHref(null)).toBeNull()
  })
})
