---
name: The lens seals the frames a sealed screen opens inside it
number: 202
group: ready
status: proposed 2026-10-27 from the live check of What everyone sees (#194) · verify first
summary: >
  Settings → What everyone sees promises that nothing on the tab reads or writes a real row. Its seal
  covers only the window the lens names. A screen drawn in a sealed frame can open iframes of its own,
  and those run the real app on the origin's real storage, where the dev's real session lives. What
  customers see is one such screen, because its sample previews are nested iframes. Without a session
  the previews made only sample-token reads. Whether a signed-in preview reads a real row is not known.
next: Verify first, signed in on the dev server. If a nested preview reads a real row, seal the same-origin frames a sealed window creates. If none does, write that down and retire this.
size: S
blocker: None. The check decides whether any code is needed.
ver: v2.5960 · 5970 · 5975
opinion: build — the tab's promise is that nothing in it is real, so a gap in it is worth closing or ruling out
mockup: not required — no screen changes, and the frames draw as they do now
---

# The lens seals the frames a sealed screen opens inside it (#202)

## The ask

The owner, 2026-10-27: *"add the seal the frames a sealed screens opens inside it task to the
punchlist"*. It came out of the live check of Settings → **What everyone sees** after it shipped
(v2.5960 to v2.5972, then v2.5975).

## What was found

The seal (`src/lib/lens/seal.ts`, the first import in `src/main.tsx`) swaps storage, network,
realtime, cross-window channels and sensors only in a window named `pipetooling-lens:{...}`. It
already carries the name to a new tab opened from a sealed frame. A frame the screen itself puts
inside the page is not covered.

Measured on clicktooling.com, 2026-10-27, with What customers see drawn sealed as the invented dev:

- **In the browser pane, signed in as the owner:** each nested preview's storage held the real
  `sb-*-auth-token`. The previews are `loading="lazy"`, and in the hidden pane they never rendered,
  so their reads were not seen.
- **In headless Chrome with no session:** the previews made 16 GETs. All went to sample-token edge
  functions: `get-estimate-for-customer`, `get-estimate-public-terms`, `get-contract-for-signer`,
  `get-job-contract`, `get-bid-proposal-room`, `get-rfq-quote-page`, `get-submittal-room`,
  `customer-portal`, `sub-portal` and `gc-trade-portal`. None went to `/rest/v1/` or `/auth/v1/`.

## Verify first

1. Sign in on the dev server with `/dev-login?as=1&to=/settings?tab=settings-what-everyone-sees`.
2. Pick Who → **Dev** and Where → **What customers see**.
3. Get the previews to load. Scroll each one into view, or press **Open alone ↗** and scroll in
   that tab.
4. For each nested frame, read `performance.getEntriesByType('resource')`. A request to `/rest/v1/`
   or `/auth/v1/` is a real read. A `/functions/v1/` request on a `sample` token is a sample read and
   is fine.

If no preview makes a real read, say so in the Glossary's *The lens's sealed frame* entry and retire
this to-do.

## If a preview reads a real row

- In `installSeal`, seal the same-origin frames a sealed window creates, before they navigate. A hook
  on the iframe's `src` or a `MutationObserver` can set the frame's name first. A frame named
  `pipetooling-lens:` boots sealed.
- The previews answer from their sample tokens through edge functions, and the engine answers only
  three functions (`LENS_FUNCTIONS` in `src/lib/lens/world/lensWorldAnswers.ts`). There are two ways
  through:
  - In a nested sealed frame, let a `/functions/v1/` call that carries a `sample` token go to the
    network. This is the smaller change.
  - Have the world answer each sample function. This keeps the page fully offline.
- Keep the lens's own top-level customer-page frames as they are. They are unsealed by design, on
  their sample tokens (`spec.config` is null in `src/lib/lens/lensTab.ts`).

## Where it plugs in

- `src/lib/lens/seal.ts`: `installSeal`, beside the `window.open` and `a[target]` handling.
- `src/lib/lens/lensName.ts`: `formatLensName` and `parseLensName`.
- `src/components/settings/SettingsWhatCustomersSeeTab.tsx`: the nested previews.
- Tests go beside `src/lib/lens/seal.test.ts`. Its jsdom iframes have no `contentDocument`, so test
  the naming hook directly.
- Docs: the Glossary's *The lens's sealed frame* and the sealed-frame note in `ACCESS_CONTROL.md`.

## How to verify

After the fix, open the lens on clicktooling.com and draw What customers see as the Dev. Scroll every
preview in. No frame should make a `/rest/v1/` or `/auth/v1/` request, and each preview should still
draw its sample.
