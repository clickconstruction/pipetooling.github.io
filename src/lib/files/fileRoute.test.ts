import { describe, expect, it } from 'vitest'
import { FILE_OPEN_WORDS, FILE_ROUTE_PATH, fileHref, fileRouteOf, fileUrl } from './fileRoute'

describe('fileRoute', () => {
  it('writes a kept file\'s lasting path and reads it back', () => {
    expect(fileHref('messages', '3f1a-9c')).toBe('/files/messages/3f1a-9c')
    expect(fileRouteOf('/files/messages/3f1a-9c')).toEqual({ source: 'messages', id: '3f1a-9c' })
    expect(fileRouteOf('/files/messages/3f1a-9c/')).toEqual({ source: 'messages', id: '3f1a-9c' })
    expect(fileRouteOf(fileHref('messages', 'a b/c'))).toEqual({ source: 'messages', id: 'a b/c' })
    expect(fileUrl('messages', '3f1a-9c')).toBe('https://clicktooling.com/files/messages/3f1a-9c')
  })

  it('reads nothing from another path, another source or no id', () => {
    expect(fileRouteOf('/files/drive/abc')).toBeNull()
    expect(fileRouteOf('/files/messages/')).toBeNull()
    expect(fileRouteOf('/gc?view=messages')).toBeNull()
    expect(fileRouteOf('/files/messages/%E0%A4%A')).toBeNull()
  })

  it('declares the route the app serves, and the words in place of a file it cannot open', () => {
    expect(FILE_ROUTE_PATH).toBe('/files/:source/:id')
    expect(FILE_OPEN_WORDS).toEqual({ signIn: 'Sign in to open this file.', notYours: 'This file is not one you can open.', notHere: 'This file is not here.' })
  })
})
