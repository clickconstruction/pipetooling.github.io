import { describe, expect, it } from 'vitest'
import { fileHost, fileLinks } from './fileLinks'

describe('fileLinks: a file host\'s link is kept as a link', () => {
  it("knows each host's file links", () => {
    expect(fileHost('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view')).toBe('drive')
    expect(fileHost('https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUv')).toBe('drive')
    expect(fileHost('https://docs.google.com/spreadsheets/d/1AbC/edit')).toBe('drive')
    expect(fileHost('https://www.dropbox.com/scl/fi/abc/Plans.pdf?dl=0')).toBe('dropbox')
    expect(fileHost('https://www.dropbox.com/s/abc/Plans.pdf')).toBe('dropbox')
    expect(fileHost('https://app.box.com/s/abc123')).toBe('box')
    expect(fileHost('https://we.tl/t-AbC123')).toBe('wetransfer')
    expect(fileHost('https://wetransfer.com/downloads/abc/def')).toBe('wetransfer')
    expect(fileHost('https://1drv.ms/b/s!AbC')).toBe('onedrive')
    expect(fileHost('https://builder.sharepoint.com/:b:/s/Projects/AbC')).toBe('sharepoint')
  })

  it("leaves out a host's other pages and every other link", () => {
    for (const url of ['https://www.google.com/search?q=x', 'https://www.dropbox.com/home', 'https://www.box.com/pricing', 'https://builder.sharepoint.com/sites/x', 'https://hillside.example/plans.pdf', 'not a link']) {
      expect(fileHost(url)).toBeNull()
    }
  })

  it('names a link by its file when the path carries one, else by its host, once each', () => {
    expect(
      fileLinks([
        'https://www.dropbox.com/scl/fi/abc/Addendum%202.pdf?dl=0',
        'https://hillside.example/about',
        'https://we.tl/t-AbC123',
        'https://www.dropbox.com/scl/fi/abc/Addendum%202.pdf?dl=0',
      ]),
    ).toEqual([
      { url: 'https://www.dropbox.com/scl/fi/abc/Addendum%202.pdf?dl=0', host: 'dropbox', name: 'Addendum 2.pdf' },
      { url: 'https://we.tl/t-AbC123', host: 'wetransfer', name: 'WeTransfer link' },
    ])
  })
})
