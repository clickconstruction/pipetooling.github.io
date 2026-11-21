/**
 * The one file inside a zip, inflated (punch list #411: the plumbing board zips its two largest licensee files).
 * It reads the central directory, so a zip written with a data descriptor, whose local header carries no sizes,
 * still works. Stored and deflated entries only. No dependency: `DecompressionStream` is in Deno and in Node.
 * A deflated entry's checksum is checked as it is inflated, so a damaged file is refused, never read as a short one.
 * Tested from `src/lib/licenseRoll/zipFirst.test.ts`.
 */
export async function unzipFirst(bytes: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  // The end record is the last 22 bytes, or sits before a comment of at most 65,535.
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 65_557; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('The file is not a zip.')
  const central = view.getUint32(eocd + 16, true)
  if (central + 46 > bytes.length || view.getUint32(central, true) !== 0x02014b50) throw new Error('The zip has no file list.')
  const method = view.getUint16(central + 10, true)
  const packed = view.getUint32(central + 20, true)
  const local = view.getUint32(central + 42, true)
  if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new Error('The zip has no file in it.')
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
  if (start + packed > bytes.length) throw new Error('The zip is cut short.')
  const data = bytes.subarray(start, start + packed)
  if (method === 0) return data
  if (method !== 8) throw new Error('The zip is packed a way this cannot read.')
  // A zip entry is a bare deflate stream. Dressed as gzip, with the checksum and length the file list already
  // holds, every runtime's `DecompressionStream` reads it, and the checksum is checked on the way out.
  const gz = new Uint8Array(10 + data.length + 8)
  gz.set([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, 0, 0x03], 0)
  gz.set(data, 10)
  const tail = new DataView(gz.buffer, 10 + data.length, 8)
  tail.setUint32(0, view.getUint32(central + 16, true), true)
  tail.setUint32(4, view.getUint32(central + 24, true), true)
  const inflated = new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip')))
  return new Uint8Array(await inflated.arrayBuffer())
}
