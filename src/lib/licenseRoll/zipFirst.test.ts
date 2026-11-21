import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { unzipFirst } from '../../../supabase/functions/_shared/zipFirst'

/** CRC-32, as a zip's file list carries it. */
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

/** A one-file zip, written by hand so the test names every byte the reader leans on. */
function zipOf(name: string, text: string, opts: { stored?: boolean; descriptor?: boolean; comment?: string; badChecksum?: boolean } = {}): Uint8Array {
  const raw = Buffer.from(text, 'utf8')
  const data = opts.stored ? raw : deflateRawSync(raw)
  const nameBytes = Buffer.from(name, 'utf8')
  const method = opts.stored ? 0 : 8
  const flags = opts.descriptor ? 0x08 : 0

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(flags, 6)
  local.writeUInt16LE(method, 8)
  // With a data descriptor the local header carries no sizes: the reader must take them from the file list.
  local.writeUInt32LE(opts.descriptor ? 0 : data.length, 18)
  local.writeUInt32LE(opts.descriptor ? 0 : raw.length, 22)
  local.writeUInt16LE(nameBytes.length, 26)
  local.writeUInt16LE(0, 28)
  const descriptor = opts.descriptor ? Buffer.alloc(16) : Buffer.alloc(0)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(flags, 8)
  central.writeUInt16LE(method, 10)
  central.writeUInt32LE(opts.badChecksum ? 1 : crc32(raw), 16)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(raw.length, 24)
  central.writeUInt16LE(nameBytes.length, 28)
  central.writeUInt32LE(0, 42)

  const body = Buffer.concat([local, nameBytes, data, descriptor])
  const comment = Buffer.from(opts.comment ?? '', 'utf8')
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + nameBytes.length, 12)
  end.writeUInt32LE(body.length, 16)
  end.writeUInt16LE(comment.length, 20)
  return new Uint8Array(Buffer.concat([body, central, nameBytes, end, comment]))
}

const TEXT = 'RANK,LICENSE_NBR\r\nJ,000412\r\n'.repeat(400)
const read = async (zip: Uint8Array) => new TextDecoder().decode(await unzipFirst(zip))

describe('unzipFirst', () => {
  it('inflates the one file in a zip', async () => {
    expect(await read(zipOf('JP.csv', TEXT))).toBe(TEXT)
  })
  it('reads a stored file as it is', async () => {
    expect(await read(zipOf('JP.csv', TEXT, { stored: true }))).toBe(TEXT)
  })
  it('takes the sizes from the file list when the local header has none', async () => {
    expect(await read(zipOf('JP.csv', TEXT, { descriptor: true }))).toBe(TEXT)
  })
  it('finds the end record behind a comment', async () => {
    expect(await read(zipOf('JP.csv', TEXT, { comment: 'made up' }))).toBe(TEXT)
  })
  it('refuses a file whose checksum does not hold', async () => {
    await expect(unzipFirst(zipOf('JP.csv', TEXT, { badChecksum: true }))).rejects.toThrow()
  })
  it('says so when the bytes are not a zip, or are cut short', async () => {
    await expect(unzipFirst(new TextEncoder().encode('RANK,LICENSE_NBR\nJ,1\n'.repeat(4)))).rejects.toThrow('The file is not a zip.')
    const zip = zipOf('JP.csv', TEXT)
    const cut = new Uint8Array([...zip.subarray(0, 40), ...zip.subarray(zip.length - 80)])
    await expect(unzipFirst(cut)).rejects.toThrow()
  })
})
