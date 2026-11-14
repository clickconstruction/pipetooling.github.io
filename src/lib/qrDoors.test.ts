/**
 * Every code the app prints or shows, and whether the address behind it needs a sign-in (v2.7182, the owner's ask of
 * 2026-11-13: a scan that meets the sign-in must still land where the code pointed).
 *
 * A file that draws a code is on `QR_DRAWERS` with what its code opens. A new one fails this test until it is added,
 * and that is the moment to answer the question: is the address public, or behind the sign-in? Behind the sign-in, it
 * also gets a row in `SIGN_IN_DOORS` in `signInReturnAddress.test.ts`, which holds it through every way of signing in.
 *
 * The second test holds the one writer: only `signInReturnAddress.ts` stores the address to come back to.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')

type Door =
  /** A page with no sign-in: the code is the key, or the page is for a customer, a sub or a GC. */
  | 'public'
  /** Behind the sign-in gate: `SignedOutGate` keeps the address. */
  | 'sign-in, kept by the gate'
  /** A public page with a Sign in press that keeps its own address (`keepReturnAddress`). */
  | 'public, with a Sign in press that keeps the address'
  /** Draws a code for a caller that hands it the address; the caller is on this list. */
  | 'helper'

const QR_DRAWERS: Readonly<Record<string, { opens: string; door: Door }>> = {
  'src/components/jobs/BillQrModal.tsx': { opens: "a bill's pay page, /pay/<id>", door: 'public' },
  'src/components/machines/MachineLabelModal.tsx': { opens: "a machine's check, /m/<code>", door: 'sign-in, kept by the gate' },
  'src/components/materials/LabelsPrintModal.tsx': { opens: "a box's page, prts.co/b/<code>", door: 'public, with a Sign in press that keeps the address' },
  'src/components/materials/ManifestPrintModal.tsx': { opens: "a box's page, prts.co/b/<code>", door: 'public, with a Sign in press that keeps the address' },
  'src/components/materials/TapeStripBitmap.tsx': { opens: 'the box address LabelsPrintModal hands it', door: 'helper' },
  'src/components/paintedMap/PaintedMapCopies.tsx': { opens: "a painted map's shared page, /way/<code>, on a printed page", door: 'public' },
  'src/components/paintedMap/PaintedMapShareSheet.tsx': { opens: "a painted map's shared page, /way/<code>", door: 'public' },
  'src/lib/billing/payQr.ts': { opens: 'the address its caller hands it', door: 'helper' },
  'src/lib/customerSampleEmails.ts': { opens: "a customer's portal, in a sample of the email", door: 'public' },
  'src/lib/jobs/lienHelpGuideCode.ts': { opens: "a job's Lien window, the Lien desk, or a guide's share page", door: 'sign-in, kept by the gate' },
  'src/lib/jobs/lienNoticePayPageAssets.ts': { opens: "a bill's pay page", door: 'public' },
  'src/lib/jobsDocuments/gcStatementEmail.ts': { opens: "a GC's portal", door: 'public' },
  'src/lib/mail/runDocsmitIo.ts': { opens: "a bill's pay page, on a mailed letter", door: 'public' },
  'src/lib/materials/tapeStrip.ts': { opens: 'the address its caller hands it', door: 'helper' },
  'src/lib/submittals/procurementSheetAssets.ts': { opens: "a GC's review room, /submittal", door: 'public' },
  'src/pages/CustomerPortal.tsx': { opens: "the customer's own portal", door: 'public' },
  'src/pages/FirstLooks.tsx': { opens: 'a First look, /show/<code>', door: 'public' },
  'src/pages/SubPortal.tsx': { opens: "the sub's own portal, /s/<slug>", door: 'public' },
  'supabase/functions/gc-statement-email-dispatch/index.ts': { opens: "a GC's portal, in the statement email", door: 'public' },
  'supabase/functions/send-gc-statement-email/index.ts': { opens: "a GC's portal, in the statement email", door: 'public' },
  'supabase/functions/send-lien-release-email/index.ts': { opens: "a customer's portal, in the release email", door: 'public' },
  'supabase/functions/send-stripe-invoice/index.ts': { opens: "a customer's portal, in the bill's email", door: 'public' },
}

/** What a file that draws a code holds: the React drawer, the two kernels' calls, or the pay code's two helpers. */
const DRAWS_A_CODE = /from 'qrcode\.react'|\bqrMatrix\(|\bpayQrSvgMarkup\(|\bpayQrPngDataUrl\(|\bqrSquares\(/

const SKIP_DIRS = new Set(['node_modules', '_shared', 'dist', '.cache'])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) sourceFiles(path, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

const FILES = [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'supabase', 'functions'))].map((path) => ({
  rel: relative(ROOT, path).split('\\').join('/'),
  text: readFileSync(path, 'utf8'),
}))

describe('every code the app draws says what it opens', () => {
  it('a file that draws a code is on the list, and the list names no file that draws none', () => {
    const drawers = FILES.filter((f) => DRAWS_A_CODE.test(f.text))
      .map((f) => f.rel)
      .sort()
    expect(drawers, 'a new code: add its file to QR_DRAWERS with what it opens, and a SIGN_IN_DOORS row if that needs a sign-in').toEqual(
      Object.keys(QR_DRAWERS).sort(),
    )
  })

  it('a code behind the sign-in is one of two kinds, each kept across it', () => {
    const behind = Object.entries(QR_DRAWERS).filter(([, d]) => d.door !== 'public' && d.door !== 'helper')
    expect(behind.map(([file]) => file).sort()).toEqual([
      'src/components/machines/MachineLabelModal.tsx',
      'src/components/materials/LabelsPrintModal.tsx',
      'src/components/materials/ManifestPrintModal.tsx',
      'src/lib/jobs/lienHelpGuideCode.ts',
    ])
  })
})

describe('the address to come back to has one writer', () => {
  it('only signInReturnAddress.ts stores it', () => {
    const writers = FILES.filter((f) => /setItem\(\s*POST_LOGIN_REDIRECT_KEY\b/.test(f.text)).map((f) => f.rel)
    expect(writers, 'call keepReturnAddress: it holds the address to the rule and notes the time').toEqual(['src/lib/signInReturnAddress.ts'])
  })

  it('the three doors outside the gate call it', () => {
    for (const rel of ['src/components/materials/BoxPublicPage.tsx', 'src/pages/FileOpen.tsx', 'src/pages/TaskShortcut.tsx']) {
      const text = FILES.find((f) => f.rel === rel)?.text ?? ''
      expect(text.includes('keepReturnAddress('), rel).toBe(true)
    }
  })
})
