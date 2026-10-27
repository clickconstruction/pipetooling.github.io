import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('the seal runs first', () => {
  it('is the first import in main.tsx, so it swaps the browser before any other module reads it', () => {
    const src = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8')
    const firstImport = src.split('\n').find((l) => l.startsWith('import '))
    expect(firstImport).toBe("import './lib/lens/seal'")
  })

  it('imports nothing heavy at load: the world and its schema come in their own chunk on the first request', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/lens/seal.ts'), 'utf8')
    const imports = src.split('\n').filter((l) => /^import (?!type)/.test(l))
    expect(imports.every((l) => /from '\.\/(lensAuth|lensName|lensPeople|memoryStorage|quietSocket)'$/.test(l))).toBe(true)
    expect(src).toContain("import('./answer/lensEngine')")
  })
})
