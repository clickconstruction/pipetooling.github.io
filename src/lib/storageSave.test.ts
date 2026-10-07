// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        download: (path: string) => {
          calls.push(`download ${bucket}/${path}`)
          return Promise.resolve(path.endsWith('missing') ? { data: null, error: new Error('no') } : { data: new Blob(['x']), error: null })
        },
        createSignedUrl: (path: string) => {
          calls.push(`sign ${bucket}/${path}`)
          return Promise.resolve({ data: { signedUrl: `https://signed.test/${path}` }, error: null })
        },
      }),
    },
  },
}))
const opened: string[] = []
vi.mock('./openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => { opened.push(url) } }))

import { browserCanShow, fileNameOf, openOrSaveFromStorage, saveBlobAs, saveFromStorage } from './storageSave'

const clicks: string[] = []
const urlApi = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
let before: { create: unknown; revoke: unknown }
beforeEach(() => {
  calls.length = 0
  opened.length = 0
  clicks.length = 0
  before = { create: urlApi.createObjectURL, revoke: urlApi.revokeObjectURL }
  urlApi.createObjectURL = () => 'blob:local'
  urlApi.revokeObjectURL = () => {}
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(`${this.download} ${this.href}`) })
})
afterEach(() => {
  urlApi.createObjectURL = before.create
  urlApi.revokeObjectURL = before.revoke
  vi.restoreAllMocks()
})

describe('storageSave (v2.4610)', () => {
  it('a browser shows a PDF or a picture; a workbook, a forwarded email or a file with no name is saved', () => {
    expect(['a.pdf', 'b.PNG', 'c.jpeg', 'd.html', 'e.txt'].map(browserCanShow)).toEqual([true, true, true, true, true])
    expect(['pay-app.xlsx', 'forwarded.eml', 'notes.docx', 'photo', ''].map(browserCanShow)).toEqual([false, false, false, false, false])
    expect(fileNameOf('bids/b1/rev/0.pdf')).toBe('0.pdf')
    expect(fileNameOf('', 'copy')).toBe('copy')
  })

  it('saves from the app’s own address: a hidden link named for the file, clicked once, and nothing left in the page', () => {
    saveBlobAs(new Blob(['x']), 'NWS.pdf')
    expect(clicks).toEqual(['NWS.pdf blob:local'])
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('reads the stored file first, then saves it; a file that cannot be read is false and clicks nothing', async () => {
    expect(await saveFromStorage('bid-submittals', 'b1/r1/0.pdf', 'NWS.pdf')).toBe(true)
    expect(calls).toEqual(['download bid-submittals/b1/r1/0.pdf'])
    expect(clicks).toEqual(['NWS.pdf blob:local'])
    expect(await saveFromStorage('bid-submittals', 'b1/r1/missing', 'x.pdf')).toBe(false)
    expect(clicks).toHaveLength(1)
  })

  it('opens what the browser can show through a short link, and saves what it cannot', async () => {
    expect(await openOrSaveFromStorage('sent-documents', 'j1/bill.pdf', 'bill.pdf')).toBe(true)
    expect(opened).toEqual(['https://signed.test/j1/bill.pdf'])
    expect(calls).toEqual(['sign sent-documents/j1/bill.pdf'])
    expect(await openOrSaveFromStorage('sent-documents', 'j1/pay-app.xlsx', 'pay-app.xlsx')).toBe(true)
    expect(calls[1]).toBe('download sent-documents/j1/pay-app.xlsx')
    expect(clicks).toEqual(['pay-app.xlsx blob:local'])
    expect(opened).toHaveLength(1)
  })
})
