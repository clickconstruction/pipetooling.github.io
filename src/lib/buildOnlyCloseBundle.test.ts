import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it, vi } from 'vitest'

import { buildOnlyCloseBundle, closeBundleWritesDist } from './buildOnlyCloseBundle'

describe('closeBundleWritesDist', () => {
  it('is true for the build and for nothing else', () => {
    expect(closeBundleWritesDist('build')).toBe(true)
    // A vitest run and the dev server are both `serve`.
    expect(closeBundleWritesDist('serve')).toBe(false)
    expect(closeBundleWritesDist(undefined)).toBe(false)
  })
})

describe('buildOnlyCloseBundle', () => {
  it('runs the plugin’s closeBundle after a build resolved the config', async () => {
    const closeBundle = vi.fn()
    const plugin = buildOnlyCloseBundle({ name: 'writes-dist', closeBundle })
    plugin.configResolved({ command: 'build' })
    await plugin.closeBundle()
    expect(closeBundle).toHaveBeenCalledTimes(1)
  })

  it('skips it when a server resolved the config, which is what a test run is', async () => {
    const closeBundle = vi.fn()
    const plugin = buildOnlyCloseBundle({ name: 'writes-dist', closeBundle })
    plugin.configResolved({ command: 'serve' })
    await plugin.closeBundle()
    expect(closeBundle).not.toHaveBeenCalled()
  })

  it('skips it when the config was never resolved', async () => {
    const closeBundle = vi.fn()
    await buildOnlyCloseBundle({ name: 'writes-dist', closeBundle }).closeBundle()
    expect(closeBundle).not.toHaveBeenCalled()
  })

  it('hands back the build’s promise, so Vite waits for the work', async () => {
    let finished = false
    const plugin = buildOnlyCloseBundle({
      name: 'writes-dist',
      async closeBundle() {
        await Promise.resolve()
        finished = true
      },
    })
    plugin.configResolved({ command: 'build' })
    await plugin.closeBundle()
    expect(finished).toBe(true)
  })

  it('keeps the plugin’s other hooks and still calls its own configResolved', () => {
    const configResolved = vi.fn()
    const configureServer = vi.fn()
    const plugin = buildOnlyCloseBundle({ name: 'writes-dist', closeBundle: vi.fn(), configResolved, configureServer })
    plugin.configResolved({ command: 'serve' })
    expect(plugin.name).toBe('writes-dist')
    expect(plugin.configureServer).toBe(configureServer)
    expect(configResolved).toHaveBeenCalledWith({ command: 'serve' })
  })
})

describe('vite.config.ts', () => {
  it('wraps every plugin that has a closeBundle', () => {
    const source = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8')
    const hooks = source.match(/^\s*(async )?closeBundle\(\)/gm) ?? []
    const wraps = source.match(/return buildOnlyCloseBundle\(\{/g) ?? []
    expect(hooks.length).toBeGreaterThan(0)
    expect(wraps.length).toBe(hooks.length)
  })
})
