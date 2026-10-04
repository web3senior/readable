<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Readable conventions

- **Package manager is pnpm.** Dev server runs on port 3005.
- **Config, never literals.** Brand copy lives in `src/config/site.js`, chains and RPCs in `src/config/chains.js`, the registry in `src/config/registry.js`, and per-kind display copy plus the preview lineup in `src/config/namespaces.js`. Live namespaces come from the registry's `getNamespaces()`; a new extension is an onchain `addNamespace`, not a code change.
- **Contracts:** `contracts/` (forge, solc 0.8.36, viaIR). After any `.sol` change: `forge build --build-info`, `forge test`, `node deploy/build-artifacts.mjs` (refreshes the deploy artifact, `src/abis/Readable.json` and the frozen verification input). Contract changes need the owner's approval of a plan first; never verify a deployment without asking.
- **Tokens, never colors.** Components read CSS custom properties from `src/styles/_themes.scss` (light and dark). A module never declares a raw color, radius, shadow or font size.
- **Styling:** SCSS Modules only, BEM class names, `clsx` for combined or conditional classes, 2-space indentation.
- **Top layer:** every modal is `ui/NativeDialog` (`&[open] { display: flex }`, never a bare `display` on the closed dialog); anchored non-modal UI is `ui/NativePopover`. A dialog nested in another calls `event.stopPropagation()` in its own `onClose`/`onCancel`.
- **Feedback:** toasts go through `toast()` from `components/NextToast`; every loading indicator is a `loading-dev` export rendered through `components/Loading` (the loading toast's too), never a hand-drawn spinner SVG or a spin keyframe; skeletons from `ui/Shimmer`; empty copy from `ui/EmptyState`.
- **Motion:** `cube-motion` only: `Rise` (its `show` for exits), `Morph` and `Reveal` in React, `rise` and `leave` from the core for DOM built outside React (the toast). No hand-written keyframes for entrances or exits. Dialogs and popovers keep their CSS top-layer transitions.
- **Formatting:** native `Intl` for prices, dates and countdown units.
- **Names:** labels are NFC-normalized with ZWNJ preserved.
- **Invisible characters** (ZWNJ, NBSP, non-ASCII digits) appear in source only as `\u` escapes, never raw.
- **Terminology:** "onchain" and "offchain", never hyphenated.
