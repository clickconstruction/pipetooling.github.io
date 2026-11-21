import { describe, expect, it } from 'vitest'
import { eagerGraph, resolveSpecifier, staticImportsOf, whyEager, type ReadSource } from './entryGraph'

const reader = (files: Record<string, string>): ReadSource => (file) => (file in files ? files[file]! : null)

describe('staticImportsOf', () => {
  it('reads default, named, star, bare and re-exported imports, on one line or many', () => {
    const src = [
      "import React from 'react'",
      "import Modal, { type Props } from './Modal'",
      'import {',
      '  a,',
      '  b,',
      "} from '../lib/ab'",
      "import * as ns from './ns'",
      "import './styles.css'",
      "export * from './all'",
      "export { one } from './one'",
    ].join('\n')
    expect(staticImportsOf(src)).toEqual(['react', './Modal', '../lib/ab', './ns', './styles.css', './all', './one'])
  })

  it('leaves out what the build drops: type imports, type re-exports and a braces-only list of types', () => {
    const src = [
      "import type { A } from './types'",
      "export type { B } from './moreTypes'",
      "import { type C, type D } from './inlineTypes'",
      "import { type E, f } from './mixed'",
    ].join('\n')
    expect(staticImportsOf(src)).toEqual(['./mixed'])
  })

  it('never counts a dynamic import, a commented line or words in a block comment', () => {
    const src = [
      "const Lazy = lazy(() => import('./Lazy'))",
      "// import Gone from './Gone'",
      '/**',
      " * import Doc from './Doc'",
      ' */',
      "import Kept from './Kept'",
    ].join('\n')
    expect(staticImportsOf(src)).toEqual(['./Kept'])
  })

  it('does not run an export on into a later import in a file with no semicolons', () => {
    const src = ['export function f(a) {', '  return a', '}', "import type { T } from './t'", "import v from './v'"].join('\n')
    expect(staticImportsOf(src)).toEqual(['./v'])
  })
})

describe('resolveSpecifier', () => {
  const read = reader({ 'src/a.ts': '', 'src/dir/index.tsx': '', 'src/lib/x.tsx': '', 'src/s.css': '' })
  it('finds a file by its extension, a folder by its index, and the alias', () => {
    expect(resolveSpecifier('src/main.tsx', './a', read)).toBe('src/a.ts')
    expect(resolveSpecifier('src/main.tsx', './dir', read)).toBe('src/dir/index.tsx')
    expect(resolveSpecifier('src/components/deep/C.tsx', '../../lib/x', read)).toBe('src/lib/x.tsx')
    expect(resolveSpecifier('src/components/C.tsx', '@/lib/x', read)).toBe('src/lib/x.tsx')
    expect(resolveSpecifier('src/main.tsx', './s.css?inline', read)).toBe('src/s.css')
  })
  it('answers null for a package and for a file that is not there', () => {
    expect(resolveSpecifier('src/main.tsx', 'react', read)).toBeNull()
    expect(resolveSpecifier('src/main.tsx', './missing', read)).toBeNull()
  })
})

describe('eagerGraph', () => {
  const files = {
    'src/main.tsx': "import App from './App'\nimport './index.css'",
    'src/index.css': 'body{}',
    'src/App.tsx': "import { Provider } from './Provider'\nconst Page = lazy(() => import('./Page'))",
    'src/Provider.tsx': "import type { WindowProps } from './Window'\nconst Window = lazyWindow(() => import('./Window'))\nimport { small } from './small'",
    'src/small.ts': 'export const small = 1',
    'src/Window.tsx': "import { heavy } from './heavy'",
    'src/heavy.ts': 'x'.repeat(1000),
    'src/Page.tsx': "import { heavy } from './heavy'",
  }
  const graph = eagerGraph('src/main.tsx', reader(files))

  it('follows static imports only, so a lazy window and what it alone reads stay out', () => {
    expect([...graph.files.keys()].sort()).toEqual(['src/App.tsx', 'src/Provider.tsx', 'src/index.css', 'src/main.tsx', 'src/small.ts'])
    expect(graph.files.has('src/Window.tsx')).toBe(false)
    expect(graph.files.has('src/heavy.ts')).toBe(false)
  })

  it('adds up the bytes of what is in', () => {
    const expected = ['src/main.tsx', 'src/index.css', 'src/App.tsx', 'src/Provider.tsx', 'src/small.ts'].reduce((n, f) => n + files[f as keyof typeof files].length, 0)
    expect(graph.bytes).toBe(expected)
  })

  it('says why a file is in, back to the entry, and nothing for a file that is out', () => {
    expect(whyEager(graph, 'src/small.ts')).toEqual(['src/small.ts', 'src/Provider.tsx', 'src/App.tsx', 'src/main.tsx'])
    expect(whyEager(graph, 'src/Window.tsx')).toEqual([])
  })

  it('one plain import of the window puts it and all it reads back in', () => {
    const back = eagerGraph('src/main.tsx', reader({ ...files, 'src/Provider.tsx': "import Window from './Window'" }))
    expect(whyEager(back, 'src/heavy.ts')).toEqual(['src/heavy.ts', 'src/Window.tsx', 'src/Provider.tsx', 'src/App.tsx', 'src/main.tsx'])
    // The window's own kilobyte is counted now, where the lazy graph left it out.
    expect(back.files.get('src/heavy.ts')).toBe(1000)
    expect(back.bytes).toBeGreaterThan(1000)
    expect(graph.bytes).toBeLessThan(1000)
  })
})
