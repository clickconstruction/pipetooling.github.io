import { GuideBrowser } from '../components/GuideBrowser'

/**
 * /help — the "How do I…" page. The browser itself lives in
 * src/components/GuideBrowser.tsx (shared with Settings → Guides); this page
 * stays a thin wrapper so every existing /help?g=<slug> deep link keeps
 * working unchanged.
 */
export default function Help() {
  return <GuideBrowser autoFocusSearch />
}
