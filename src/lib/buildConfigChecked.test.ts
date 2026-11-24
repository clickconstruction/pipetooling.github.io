import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

/**
 * The build's own config is checked (2026-11-24). `tsconfig.json` reads `src` alone and eslint ignored every
 * `*.config.ts`, so `vite.config.ts` and `playwright.config.ts` were read by no typecheck and no lint, and only a
 * build caught a mistake in them. These hold the wiring, since a check nobody runs fails silently.
 */
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const CONFIG_FILES = ['vite.config.ts', 'playwright.config.ts']

describe('the build’s own config is typechecked and linted', () => {
  it('tsconfig.node.json reads both config files under the app’s options', () => {
    const config = JSON.parse(read('tsconfig.node.json')) as { extends?: string; include?: string[] }
    expect(config.extends).toBe('./tsconfig.json')
    for (const file of CONFIG_FILES) expect(config.include).toContain(file)
  })

  it('package.json has the script and the lint names both files', () => {
    const { scripts } = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(scripts['typecheck:config']).toBe('tsc -p tsconfig.node.json')
    for (const file of CONFIG_FILES) expect(scripts.lint).toContain(` ${file} `)
  })

  it('eslint no longer ignores a config written in TypeScript', () => {
    expect(read('eslint.config.js')).not.toContain("'*.config.ts'")
  })

  it('CI runs the config typecheck', () => {
    expect(read('.github/workflows/ci.yml')).toContain('run: npm run typecheck:config')
  })
})
