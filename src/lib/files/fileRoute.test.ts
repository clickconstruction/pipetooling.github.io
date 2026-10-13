import { describe, expect, it } from 'vitest'
import { FILE_OPEN_WORDS, FILE_ROUTE_PATH, driveFileHref, driveFileOfRouteId, driveFileRouteId, fileHref, fileRouteOf, fileUrl } from './fileRoute'

describe('fileRoute', () => {
  it('writes a kept file\'s lasting path and reads it back', () => {
    expect(fileHref('messages', '3f1a-9c')).toBe('/files/messages/3f1a-9c')
    expect(fileRouteOf('/files/messages/3f1a-9c')).toEqual({ source: 'messages', id: '3f1a-9c' })
    expect(fileRouteOf('/files/messages/3f1a-9c/')).toEqual({ source: 'messages', id: '3f1a-9c' })
    expect(fileRouteOf(fileHref('messages', 'a b/c'))).toEqual({ source: 'messages', id: 'a b/c' })
    expect(fileUrl('messages', '3f1a-9c')).toBe('https://clicktooling.com/files/messages/3f1a-9c')
  })

  it('reads nothing from another path, another source or no id', () => {
    expect(fileRouteOf('/files/photos/abc')).toBeNull()
    expect(fileRouteOf('/files/messages/')).toBeNull()
    expect(fileRouteOf('/gc?view=messages')).toBeNull()
    expect(fileRouteOf('/files/messages/%E0%A4%A')).toBeNull()
  })

  it('writes a Drive file with its job and reads both back, splitting at the last colon', () => {
    const job = { kind: 'project' as const, id: '7d3c2a10-4b5e-4f60-9a7b-1c2d3e4f5a6b' }
    const drive = '1AbC-dEf_GhIjKlMnOp'
    expect(driveFileRouteId(job, drive)).toBe(`project:${job.id}:${drive}`)
    expect(driveFileHref(job, drive)).toBe(`/files/drive/${encodeURIComponent(`project:${job.id}:${drive}`)}`)
    const back = fileRouteOf(driveFileHref(job, drive))
    expect(back).toEqual({ source: 'drive', id: `project:${job.id}:${drive}` })
    expect(driveFileOfRouteId(back!.id)).toEqual({ job, driveFileId: drive })
    expect(driveFileOfRouteId(`bid:${job.id}:${drive}`)?.job).toEqual({ kind: 'bid', id: job.id })
    expect(driveFileOfRouteId(`pipeline:${job.id}:${drive}`)?.job).toEqual({ kind: 'pipeline', id: job.id })
  })

  it('reads no Drive file from an id that is not a job and a file', () => {
    expect(driveFileOfRouteId('1AbC-dEf_GhIjKlMnOp')).toBeNull()
    expect(driveFileOfRouteId('project:abc:short')).toBeNull()
    expect(driveFileOfRouteId('house:7d3c2a10:1AbC-dEf_GhIjKlMnOp')).toBeNull()
    expect(driveFileOfRouteId('project:7d3c2a10:1AbC dEf GhIjK')).toBeNull()
  })

  it('declares the route the app serves, and the words in place of a file it cannot open', () => {
    expect(FILE_ROUTE_PATH).toBe('/files/:source/:id')
    expect(FILE_OPEN_WORDS).toEqual({ signIn: 'Sign in to open this file.', notYours: 'This file is not one you can open.', notHere: 'This file is not here.' })
  })
})
