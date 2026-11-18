/**
 * The version of the app this tab is running: the newest release note in its build, read at build
 * time into `virtual:app-version` by `appVersionPlugin` (vite.config.ts).
 *
 * It costs nothing at boot. It is also right on a tab still running an older build, whose files
 * the site may no longer serve. A note to the dev carries it (punch list #380).
 */
import builtVersion from 'virtual:app-version'

export const APP_VERSION: string | null = typeof builtVersion === 'string' && builtVersion ? builtVersion : null
