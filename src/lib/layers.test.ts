import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — scripts/check-layers.mjs runs the kernel on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/layers.mjs'

/**
 * scripts/lib/layers.mjs says which imports reach up a layer of `src` (punch list #434, the split's step 1).
 * These hold the rule, how an import is resolved, the list's reading and its ratchet, the words of a run, and
 * the wiring of the script, the list and the workflow.
 */
type Rule = { name: string; from: string[]; above: string[] }
type Compared = { added: string[]; mended: string[]; kept: number }
const k = kernel as {
  LAYER_RULES: Rule[]
  ALLOWED_FILE: string
  ruleFor: (file: string) => Rule | undefined
  isAbove: (rule: Rule, target: string) => boolean
  resolveImport: (from: string, specifier: string, has: (path: string) => boolean) => string | undefined
  rowOf: (from: string, to: string) => string
  upwardRows: (file: string, specifiers: string[], has: (path: string) => boolean) => string[]
  parseAllowed: (text: string) => string[]
  compareRows: (found: string[], allowed: string[]) => Compared
  withoutRows: (text: string, mended: string[]) => string
  outcomeLines: (result: Compared) => string[]
}

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const tree = (...paths: string[]) => {
  const set = new Set(paths)
  return (path: string) => set.has(path)
}

describe('which rule a file answers to', () => {
  it('holds the lowest folders to the base rule and the hooks to their own', () => {
    for (const file of ['src/lib/a.ts', 'src/lib/jobs/b.ts', 'src/utils/c.ts', 'src/types/d.ts', 'src/constants/e.ts', 'src/content/releaseNotes/v2.1.ts']) {
      expect(k.ruleFor(file)?.name, file).toBe('base')
    }
    expect(k.ruleFor('src/hooks/useThing.ts')?.name).toBe('hooks')
    expect(k.ruleFor('src/hooks/useSheet.tsx')?.name).toBe('hooks')
  })

  it('rules no test, no declaration file and no file of an upper folder', () => {
    for (const file of ['src/lib/a.test.ts', 'src/hooks/useThing.test.tsx', 'src/lib/lens/lensWindow.d.ts', 'src/components/A.tsx', 'src/pages/Jobs.tsx', 'src/contexts/ToastContext.tsx', 'src/App.tsx', 'src/lib/readme.md']) {
      expect(k.ruleFor(file), file).toBeUndefined()
    }
  })

  it('puts every upper folder and the files straight under src above the base', () => {
    const base = k.LAYER_RULES.find((rule) => rule.name === 'base')!
    for (const target of ['src/hooks/useAuth.ts', 'src/contexts/ToastContext.tsx', 'src/components/jobs/A.tsx', 'src/pages/Jobs.tsx', 'src/test/renderSmokeMocks.tsx', 'src/App.tsx']) {
      expect(k.isAbove(base, target), target).toBe(true)
    }
    for (const target of ['src/lib/a.ts', 'src/utils/c.ts', 'src/types/database.ts', 'src/constants/e.ts', 'src/content/releaseNotes.ts', 'supabase/functions/_shared/k.ts']) {
      expect(k.isAbove(base, target), target).toBe(false)
    }
  })

  it('lets a hook read the base, another hook and a context, and nothing of the components or the pages', () => {
    const hooks = k.LAYER_RULES.find((rule) => rule.name === 'hooks')!
    for (const target of ['src/lib/a.ts', 'src/hooks/useAuth.ts', 'src/contexts/ToastContext.tsx']) expect(k.isAbove(hooks, target), target).toBe(false)
    for (const target of ['src/components/jobs/A.tsx', 'src/pages/Jobs.tsx', 'src/test/renderSmokeMocks.tsx', 'src/main.tsx']) expect(k.isAbove(hooks, target), target).toBe(true)
  })

  it('names no folder as both a rule\'s own and above it', () => {
    for (const rule of k.LAYER_RULES) for (const dir of rule.from) expect(rule.above, rule.name).not.toContain(dir)
  })
})

describe('the file an import names', () => {
  const has = tree('src/hooks/useAuth.ts', 'src/components/Toast.tsx', 'src/components/jobs/index.ts', 'src/lib/a.ts', 'src/lib/jobs/b.ts', 'src/lib/lens/lensWindow.d.ts', 'src/lib/notes.md')

  it('reads the alias as src', () => {
    expect(k.resolveImport('src/lib/jobs/b.ts', '@/hooks/useAuth', has)).toBe('src/hooks/useAuth.ts')
    expect(k.resolveImport('src/lib/a.ts', '@/components/Toast', has)).toBe('src/components/Toast.tsx')
  })

  it('reads a relative name from the importing file, with or without its extension', () => {
    expect(k.resolveImport('src/lib/jobs/b.ts', '../../hooks/useAuth', has)).toBe('src/hooks/useAuth.ts')
    expect(k.resolveImport('src/lib/jobs/b.ts', '../../hooks/useAuth.ts', has)).toBe('src/hooks/useAuth.ts')
    expect(k.resolveImport('src/lib/jobs/b.ts', './../a', has)).toBe('src/lib/a.ts')
  })

  it('reads a folder as its index and a declaration file by its name', () => {
    expect(k.resolveImport('src/lib/a.ts', '@/components/jobs', has)).toBe('src/components/jobs/index.ts')
    expect(k.resolveImport('src/lib/a.ts', './lens/lensWindow', has)).toBe('src/lib/lens/lensWindow.d.ts')
  })

  it('answers nothing for a package, an asset and a name no file has', () => {
    expect(k.resolveImport('src/lib/a.ts', 'react', has)).toBeUndefined()
    expect(k.resolveImport('src/lib/a.ts', 'npm:@supabase/supabase-js@2', has)).toBeUndefined()
    expect(k.resolveImport('src/lib/a.ts', './notes.md?raw', has)).toBeUndefined()
    expect(k.resolveImport('src/lib/a.ts', '@/hooks/useGone', has)).toBeUndefined()
  })
})

describe('the rows of a file', () => {
  const has = tree('src/hooks/useAuth.ts', 'src/hooks/useOther.ts', 'src/components/Toast.tsx', 'src/contexts/ToastContext.tsx', 'src/lib/a.ts', 'src/lib/b.ts')

  it('lists each import that reaches up once, sorted', () => {
    expect(k.upwardRows('src/lib/a.ts', ['@/hooks/useAuth', './b', 'react', '@/components/Toast', '../hooks/useAuth'], has)).toEqual([
      'src/lib/a.ts -> src/components/Toast.tsx',
      'src/lib/a.ts -> src/hooks/useAuth.ts',
    ])
  })

  it('lists nothing for a hook that reads the base, a hook and a context', () => {
    expect(k.upwardRows('src/hooks/useOther.ts', ['@/lib/a', './useAuth', '@/contexts/ToastContext'], has)).toEqual([])
    expect(k.upwardRows('src/hooks/useOther.ts', ['@/components/Toast'], has)).toEqual(['src/hooks/useOther.ts -> src/components/Toast.tsx'])
  })

  it('lists nothing for a test or a component, whatever it imports', () => {
    expect(k.upwardRows('src/lib/a.test.ts', ['@/components/Toast'], has)).toEqual([])
    expect(k.upwardRows('src/components/Toast.tsx', ['@/pages/Jobs'], has)).toEqual([])
  })
})

describe('the list and its ratchet', () => {
  const text = '# why\n\nsrc/lib/a.ts -> src/hooks/useAuth.ts\n  src/lib/b.ts -> src/components/Toast.tsx  \n'

  it('reads rows past comments, blank lines and stray spaces', () => {
    expect(k.parseAllowed(text)).toEqual(['src/lib/a.ts -> src/hooks/useAuth.ts', 'src/lib/b.ts -> src/components/Toast.tsx'])
  })

  it('calls an import off the list added and a listed one that is gone mended', () => {
    const result = k.compareRows(['src/lib/a.ts -> src/hooks/useAuth.ts', 'src/lib/c.ts -> src/pages/Jobs.tsx'], k.parseAllowed(text))
    expect(result).toEqual({ added: ['src/lib/c.ts -> src/pages/Jobs.tsx'], mended: ['src/lib/b.ts -> src/components/Toast.tsx'], kept: 1 })
  })

  it('takes mended rows off and keeps the comments, the order and every other row', () => {
    expect(k.withoutRows(text, ['src/lib/b.ts -> src/components/Toast.tsx'])).toBe('# why\n\nsrc/lib/a.ts -> src/hooks/useAuth.ts\n')
    expect(k.withoutRows(text, [])).toBe(text)
  })
})

describe('the words of a run', () => {
  it('says the list\'s count when nothing new reaches up', () => {
    expect(k.outcomeLines({ added: [], mended: [], kept: 232 })).toEqual(['check:layers: no new import reaches up a layer. 232 imports on the list still do.'])
    expect(k.outcomeLines({ added: [], mended: [], kept: 1 })).toEqual(['check:layers: no new import reaches up a layer. 1 import on the list still does.'])
  })

  it('names each new import under its file, then the rule and the mend', () => {
    const lines = k.outcomeLines({ added: ['src/lib/a.ts -> src/components/Toast.tsx', 'src/lib/a.ts -> src/hooks/useAuth.ts', 'src/hooks/useX.ts -> src/pages/Jobs.tsx'], mended: [], kept: 3 })
    expect(lines[0]).toBe('check:layers: 3 new imports reach up a layer.')
    expect(lines).toContain('  src/lib/a.ts')
    expect(lines).toContain('    reads src/components/Toast.tsx')
    expect(lines).toContain('    reads src/hooks/useAuth.ts')
    expect(lines).toContain('  src/hooks/useX.ts')
    const all = lines.join('\n')
    expect(all).toContain('The rule: ')
    expect(all).toContain('The mend: ')
    expect(all).toContain('punch list #434')
    expect(all).not.toContain('no new import')
    expect(k.outcomeLines({ added: ['src/lib/a.ts -> src/hooks/useAuth.ts'], mended: [], kept: 0 })[0]).toBe('check:layers: 1 new import reaches up a layer.')
  })

  it('names the command that takes mended rows off, and still says nothing new reaches up', () => {
    const lines = k.outcomeLines({ added: [], mended: ['src/lib/b.ts -> src/components/Toast.tsx'], kept: 5 })
    expect(lines[0]).toBe(`check:layers: 1 row of ${k.ALLOWED_FILE} is mended and still on the list.`)
    expect(lines[1]).toBe('Take them off with: npm run check:layers -- --write')
    expect(lines[2]).toContain('no new import reaches up a layer')
  })
})

describe('the wiring', () => {
  it('has the list where the kernel says, every row a ruled file reading a file above it, sorted, each once', () => {
    const rows = k.parseAllowed(read(k.ALLOWED_FILE))
    expect(rows.length).toBeGreaterThan(0)
    expect([...rows].sort()).toEqual(rows)
    expect(new Set(rows).size).toBe(rows.length)
    for (const row of rows) {
      const [from, to, more] = row.split(' -> ')
      expect(more, row).toBeUndefined()
      const rule = k.ruleFor(from ?? '')
      expect(rule, row).toBeDefined()
      expect(k.isAbove(rule!, to ?? ''), row).toBe(true)
    }
  })

  it('is one npm script, run by the pull request\'s checks', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts
    expect(scripts['check:layers']).toBe('node scripts/check-layers.mjs')
    expect(read('.github/workflows/ci.yml')).toContain('run: npm run check:layers')
  })

  it('takes its imports from the TypeScript scanner and fails on a new import alone', () => {
    const script = read('scripts/check-layers.mjs')
    expect(script).toContain('ts.preProcessFile(')
    expect(script).toContain('process.exit(result.added.length ? 1 : 0)')
  })
})
