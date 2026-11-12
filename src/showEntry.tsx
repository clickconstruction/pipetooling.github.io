/**
 * A First look's page as an entry of its own (punch list #319 PR 4). The spike measured 2.4 MB over the wire before the
 * page's first word, nearly all of it the app's shell, which a customer never uses. This entry holds React and the
 * page and nothing else of the app: no router, no sign-in, no service worker. The link's code is what follows the `#`
 * (`index.html`'s first script sends `/show/<code>` here), or `?c=` for a link pasted by hand.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ShowUs from './pages/ShowUs'

function codeFromAddress(): string | null {
  const hash = window.location.hash.replace(/^#\/?/, '').trim()
  if (hash) return hash
  return new URLSearchParams(window.location.search).get('c')
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ShowUs code={codeFromAddress()} />
    </StrictMode>,
  )
}
