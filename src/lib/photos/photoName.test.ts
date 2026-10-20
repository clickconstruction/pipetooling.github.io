import { describe, expect, it } from 'vitest'
import { driveSafe, extOf, madeUpName, photoCaption, photoDriveName, type PhotoNameInput } from './photoName'

// The prototype's customer and her texted photos (quo-messages-mockup.html drafts 8 and 9, spike/gc-mode): Fri Oct 2 2026,
// 2:14 PM in Chicago.
const priya: PhotoNameInput = {
  at: '2026-10-02T19:14:00.000Z',
  sender: 'Priya Raman',
  fileName: 'Ceiling tile, op 3.jpg',
  mime: 'image/jpeg',
  words: "Here's the stain above operatory 3, and the old sink cabinet I want gone before you start.",
  place: 1,
}

describe('photoDriveName: named by day, sender and caption', () => {
  it('names the prototype’s two full-size photos the way its file agent does', () => {
    expect(photoDriveName(priya)).toBe('2026-10-02 Priya Raman · Ceiling tile op 3.jpg')
    expect(photoDriveName({ ...priya, fileName: 'Above the tile.jpg', place: 2 })).toBe('2026-10-02 Priya Raman · Above the tile.jpg')
  })

  it('takes the line’s words when the phone named the file, cut on a word', () => {
    const name = photoDriveName({ ...priya, fileName: 'picture-1.jpg' })
    expect(name).toBe("2026-10-02 Priya Raman · Here's the stain above operatory 3 and the old sink cabinet.jpg")
    expect(photoCaption({ ...priya, fileName: 'picture-1.jpg' }).length).toBeLessThanOrEqual(60)
  })

  it('dates a photo by Chicago’s day, not the clock in London', () => {
    expect(photoDriveName({ ...priya, at: '2026-10-03T04:30:00.000Z' })).toBe('2026-10-02 Priya Raman · Ceiling tile op 3.jpg')
  })

  it('gives a name the folder already holds the next number, whatever its case', () => {
    const first = photoDriveName(priya)
    expect(photoDriveName(priya, new Set([first.toUpperCase()]))).toBe('2026-10-02 Priya Raman · Ceiling tile op 3 (2).jpg')
    expect(photoDriveName(priya, new Set([first, '2026-10-02 Priya Raman · Ceiling tile op 3 (2).jpg']))).toBe(
      '2026-10-02 Priya Raman · Ceiling tile op 3 (3).jpg',
    )
  })

  it('keeps an iPhone’s HEIC as HEIC, from its name when the type says nothing', () => {
    expect(photoDriveName({ ...priya, fileName: 'IMG_2041.HEIC', mime: null, words: 'Panel, suite 140' })).toBe(
      '2026-10-02 Priya Raman · Panel suite 140.heic',
    )
  })

  it('names a number nobody named by the number, and nobody at all as Someone', () => {
    expect(photoDriveName({ ...priya, sender: '(830) 555-0172' })).toBe('2026-10-02 (830) 555-0172 · Ceiling tile op 3.jpg')
    expect(photoDriveName({ ...priya, sender: '  ' })).toBe('2026-10-02 Someone · Ceiling tile op 3.jpg')
  })

  it('says Photo and its place when there is no name and no words', () => {
    expect(photoDriveName({ ...priya, fileName: 'picture-2.jpg', words: '', place: 2 })).toBe('2026-10-02 Priya Raman · Photo 2.jpg')
    expect(photoDriveName({ ...priya, fileName: 'picture-2.jpg', words: 'https://click.co/t/7q2', place: 2 })).toBe(
      '2026-10-02 Priya Raman · Photo 2.jpg',
    )
  })
})

describe('the parts of a name', () => {
  it('knows a name a phone or an app made from one a person chose', () => {
    for (const made of ['IMG_2041.jpg', 'IMG_2041 (1).jpg', 'image0.png', 'picture-1.jpg', 'PXL_20261002_141233123.jpg', 'DSC_0042.JPG', '20261002_141233.jpg', 'Screenshot 2026-10-02 at 2.14.33 PM.png', 'WhatsApp Image 2026-10-02 at 14.12.33.jpeg', '3f2a9c4e-8b1d-4e2a-9f00-5c1d2e3f4a5b.jpg', '']) {
      expect(madeUpName(made), made).toBe(true)
    }
    for (const chosen of ['Ceiling tile, op 3.jpg', 'Sink cabinet.jpg', 'Photo of pad B.jpg', 'Scan of W-9.pdf', 'RTU nameplate.jpg']) {
      expect(madeUpName(chosen), chosen).toBe(false)
    }
  })

  it('keeps a name a computer can save: no slashes, colons, quotes, commas or links', () => {
    expect(driveSafe('Pad B: north / east, "before"  https://x.example/a.jpg ...')).toBe('Pad B north east before')
  })

  it('takes the ending from the type, then from the name', () => {
    expect(extOf('image/jpeg; charset=binary')).toBe('jpg')
    expect(extOf('image/heic')).toBe('heic')
    expect(extOf(null, 'sink.PNG')).toBe('png')
    expect(extOf('application/octet-stream', 'note')).toBe('')
  })
})
