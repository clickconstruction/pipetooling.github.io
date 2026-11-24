/**
 * A plugin whose `closeBundle` writes into `dist/` does that work for `vite build` and for nothing else.
 *
 * Vite's dev server calls every plugin's `buildEnd` and `closeBundle` when it closes, and a `vitest` run
 * is a Vite server (`command: 'serve'`). Until 2026-11-24 each test run therefore copied the mock-ups and
 * the pdf.js files into `dist/` and drew a share card per help guide in Chromium, and so did a dev server
 * closed with `q`. `vite.config.ts` wraps every such plugin in `buildOnlyCloseBundle`, which reads the
 * command at `configResolved`; a plugin that was never resolved writes nothing.
 */
export function closeBundleWritesDist(command: string | undefined): boolean {
  return command === 'build'
}

type ResolvedCommand = { command: string }

type DistWritingPlugin = {
  name: string
  closeBundle: () => void | Promise<void>
  configResolved?: (config: ResolvedCommand) => void
}

export function buildOnlyCloseBundle<P extends DistWritingPlugin>(plugin: P): P & { configResolved: (config: ResolvedCommand) => void } {
  let command: string | undefined
  const { closeBundle, configResolved } = plugin
  return {
    ...plugin,
    configResolved(config: ResolvedCommand) {
      command = config.command
      configResolved?.call(this, config)
    },
    closeBundle() {
      return closeBundleWritesDist(command) ? closeBundle.call(this) : undefined
    },
  }
}
