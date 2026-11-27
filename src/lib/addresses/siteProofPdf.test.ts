/**
 * The proof's packet as one PDF (punch list #439, piece 5, part 5b): the list's lines, the press's words, and the
 * merge with real pdf-lib, which goes on past a copy it cannot have. Every company and person here is made up.
 */
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { SiteProof } from './siteProof'
import { buildProofPacket, copiesFollowWords, downloadLabel, downloadOutcomeWords, proofFileName, proofPdfLines, type ProofPacketInput } from './siteProofPdf'

const PROOF: SiteProof = {
  signed: [
    { id: 'a', company: 'Tallgrass Supply Co.', paper: 'Vendor NDA', signer: 'Lena Park, Branch manager', day: 'Nov 12' },
    { id: 'b', company: 'Placeholder Fence Co.', paper: 'Vendor NDA', signer: 'Sam Placeholder, Owner', day: 'Nov 14' },
    { id: 'c', company: 'Sample Electric Supply', paper: 'Site form', signer: '', day: 'Nov 18' },
  ],
  asked: [{ id: 'w', company: 'Example Pipe & Valve', paper: 'Vendor NDA', signer: 'Lee Example', day: 'Nov 20' }],
}
const INPUT: ProofPacketInput = { proof: PROOF, clientName: 'Sample Owner LLC', siteName: 'Old Quarry Ranch', ownWords: '18 of 21 have signed.', todayYmd: '2026-11-27' }
const pdfOf = async (pages: number): Promise<Blob> => {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([612, 792])
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
}
const pagesOf = async (blob: Blob): Promise<number> => (await PDFDocument.load(await blob.arrayBuffer())).getPageCount()

describe('the press and what it says after', () => {
  it('names how many signed copies it goes for, and downloads the list alone when nobody has signed', () => {
    expect(downloadLabel(PROOF, false)).toBe('Download with 3 signed copies')
    expect(downloadLabel({ signed: PROOF.signed.slice(0, 1), asked: [] }, false)).toBe('Download with 1 signed copy')
    expect(downloadLabel({ signed: [], asked: PROOF.asked }, false)).toBe('Download the list')
    expect(downloadLabel(PROOF, true)).toBe('Making the PDF…')
  })
  it('says what was attached, and names each copy that was not with its reason', () => {
    expect(downloadOutcomeWords(3, [])).toBe('Downloaded, with 3 signed copies attached.')
    expect(downloadOutcomeWords(1, [])).toBe('Downloaded, with 1 signed copy attached.')
    expect(downloadOutcomeWords(0, [])).toBe('Downloaded the list.')
    expect(downloadOutcomeWords(2, [{ id: 'c', company: 'Sample Electric Supply', paper: 'Site form', reason: 'This paper is a form.' }])).toBe(
      'Downloaded, with 2 of 3 signed copies attached. Not attached: Sample Electric Supply: This paper is a form.',
    )
  })
  it('the file is named for the site, with nothing a file system refuses', () => {
    expect(proofFileName('Old Quarry Ranch')).toBe('The proof - Old Quarry Ranch.pdf')
    expect(proofFileName('Ranch: lot 4/5')).toBe('The proof - Ranch lot 4 5.pdf')
    expect(proofFileName(null)).toBe('The proof.pdf')
  })
  it('the foot says the day and how many copies follow', () => {
    expect(copiesFollowWords('2026-11-27', 3)).toBe('As of Nov 27. The 3 signed copies follow.')
    expect(copiesFollowWords('2026-11-27', 1)).toBe('As of Nov 27. The 1 signed copy follows.')
    expect(copiesFollowWords('2026-11-27', 0)).toBe('As of Nov 27. No signed copy is attached.')
    for (const words of [copiesFollowWords('2026-11-27', 3), copiesFollowWords('2026-11-27', 0), downloadOutcomeWords(3, [])]) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('the list page', () => {
  it('says beside each signed company that its copy is attached, or why it is not', () => {
    const lines = proofPdfLines(INPUT, new Set(['a', 'b']), [{ id: 'c', company: 'Sample Electric Supply', paper: 'Site form', reason: 'This paper is a form.' }])
    expect(lines[0]).toEqual({ kind: 'title', text: 'The proof for Sample Owner LLC' })
    expect(lines.filter((l) => l.kind === 'row')).toEqual([
      { kind: 'row', company: 'Tallgrass Supply Co.', right: 'Signed Nov 12', subs: ['Signed by Lena Park, Branch manager', 'Vendor NDA', 'Signed copy attached.'] },
      { kind: 'row', company: 'Placeholder Fence Co.', right: 'Signed Nov 14', subs: ['Signed by Sam Placeholder, Owner', 'Vendor NDA', 'Signed copy attached.'] },
      { kind: 'row', company: 'Sample Electric Supply', right: 'Signed Nov 18', subs: ['Site form', 'Copy not attached. This paper is a form.'] },
      { kind: 'row', company: 'Example Pipe & Valve', right: 'Sent Nov 20', subs: ['Sent to Lee Example', 'Vendor NDA'] },
    ])
    const said = lines.flatMap((l) => ('text' in l ? [l.text] : []))
    expect(said).toContain('Old Quarry Ranch')
    expect(said).toContain('3 companies signed. 1 asked, not yet signed.')
    expect(said).toContain('18 of 21 have signed.')
    expect(said[said.length - 1]).toBe('As of Nov 27. The 2 signed copies follow.')
  })
  it('with nobody signed it says so, and with our own people not asked it says nothing of them', () => {
    const lines = proofPdfLines({ ...INPUT, proof: { signed: [], asked: PROOF.asked }, ownWords: null }, new Set(), [])
    const said = lines.flatMap((l) => ('text' in l ? [l.text] : []))
    expect(said).toContain('No company has signed yet.')
    expect(said).not.toContain('Our own people')
    expect(said[said.length - 1]).toBe('As of Nov 27. No signed copy is attached.')
  })
})

describe('the packet, with real pdf-lib', () => {
  it('is the list page and then every signed copy, in the list’s order', async () => {
    const asked: string[] = []
    const packet = await buildProofPacket(INPUT, async (id) => {
      asked.push(id)
      return pdfOf(id === 'b' ? 2 : 1)
    })
    expect(asked).toEqual(['a', 'b', 'c'])
    expect(packet.attached).toBe(3)
    expect(packet.held).toEqual([])
    expect(packet.blob.type).toBe('application/pdf')
    expect(await pagesOf(packet.blob)).toBe(1 + 1 + 2 + 1)
  })
  it('goes on past a copy it cannot have, and holds it with its reason', async () => {
    const packet = await buildProofPacket(INPUT, async (id) => {
      if (id === 'c') throw new Error('This paper is a form. Open its PDF from the form’s own press.')
      if (id === 'b') return new Blob(['not a pdf'], { type: 'text/plain' })
      return pdfOf(1)
    })
    expect(packet.attached).toBe(1)
    expect(packet.held.map((h) => [h.company, h.id])).toEqual([['Placeholder Fence Co.', 'b'], ['Sample Electric Supply', 'c']])
    expect(packet.held[1]!.reason).toBe('This paper is a form. Open its PDF from the form’s own press.')
    expect(await pagesOf(packet.blob)).toBe(2)
  })
  it('with nobody signed it is the list alone, and asks for no copy', async () => {
    let asked = 0
    const packet = await buildProofPacket({ ...INPUT, proof: { signed: [], asked: PROOF.asked } }, async () => {
      asked += 1
      return pdfOf(1)
    })
    expect(asked).toBe(0)
    expect(await pagesOf(packet.blob)).toBe(1)
  })
  it('a long list runs onto a second page, and a name pdf-lib’s font cannot write does not stop it', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, company: `Sample Company ${i} ✓ 株式会社`, paper: 'Vendor NDA', signer: 'A Person, Owner', day: 'Nov 12' }))
    const packet = await buildProofPacket({ ...INPUT, proof: { signed: many, asked: [] } }, async () => {
      throw new Error('offline')
    })
    expect(packet.attached).toBe(0)
    expect(packet.held).toHaveLength(30)
    expect(await pagesOf(packet.blob)).toBeGreaterThan(1)
  })
})
