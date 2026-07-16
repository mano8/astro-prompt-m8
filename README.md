# @mano8/astro-prompt-m8

![CI/CD](https://github.com/mano8/astro-prompt-m8/actions/workflows/CI.yaml/badge.svg?branch=main)

Astro integration and headless client for [`prompt-engine-m8`]. The prompt-side
analog of `@mano8/astro-media-m8`: typed Zod schemas, API wrappers for the full
prompt contract, a compose helper, optional React provider/hooks, and injectable
starter routes — so any Astro stack can drive prompt blocks/templates/composition
without re-implementing the contract.

Part of the M8 prompt stack: [mano8/astro-prompt-m8](https://github.com/mano8/astro-prompt-m8)
requires [mano8/astro-auth-m8](https://github.com/mano8/astro-auth-m8) as its
auth peer for fa-auth-m8 token delegation, consumes shared UI/registry blocks
from [mano8/astro-ui-m8](https://github.com/mano8/astro-ui-m8), targets the
prompt backend at [mano8/prompt-engine-m8](https://github.com/mano8/prompt-engine-m8),
and composes into the [mano8/fa-ui-m8](https://github.com/mano8/fa-ui-m8) host app.

### Related repositories

- [`prompt-engine-m8`](https://github.com/mano8/prompt-engine-m8) — the FastAPI backend this plugin fronts.
- [`astro-ui-m8`](https://github.com/mano8/astro-ui-m8) — canonical shared shadcn registry (data-table, state components) this plugin's admin views build on.
- [`astro-auth-m8`](https://github.com/mano8/astro-auth-m8) — required auth peer; issues the fa-auth-m8 tokens this plugin's adapter consumes.
- [`fa-ui-m8`](https://github.com/mano8/fa-ui-m8) — the Astro/Starlight host app this plugin installs into.

Pinned to `prompt-engine-m8@1.0` (supported service-version range
`>=1.0.0 <2.0.0`; see `promptEngineM8` in `package.json`).

## Table of contents

- [Backend contract](#backend-contract)
- [Install](#install)
- [Modes](#modes)
- [Quick start](#quick-start)
- [Headless usage](#headless-usage)
- [Dynamic block placeholders](#dynamic-block-placeholders)
- [Security model](#security-model)
- [Content Security Policy](#content-security-policy)
- [shadcn views (registry)](#shadcn-views-registry)
- [Contract surface](#contract-surface)
- [Commands](#commands)
- [License](#license)

## Backend contract

This package targets the `prompt-engine-m8@1.0` API contract and was tested
against `prompt-engine-m8` service version `1.1.0`. Supported backend service
versions are `>=1.0.0 <2.0.0`.

Compatibility helpers are exported from `@mano8/astro-prompt-m8/compatibility`.
Pass the backend `/meta` payload (or flat version fields) straight to the assert:

```ts
import { assertPromptEngineM8Compatibility } from "@mano8/astro-prompt-m8/compatibility";

const meta = await fetch(`${base}/prompt/meta`).then((r) => r.json());
assertPromptEngineM8Compatibility(meta);
```

The helper also accepts flat fields (`prompt_contract_version` /
`contract_version` / `service_version`) for backends that surface metadata
elsewhere.

## Install

```sh
npm i @mano8/astro-prompt-m8 @mano8/astro-auth-m8 zod
```

`@astrojs/starlight` and `@astrojs/react` are required for starter routes because
the package routes render through Starlight's page shell and hydrate React
islands. `@mano8/astro-auth-m8` is a required peer: `prompt-engine-m8` only accepts
`fa-auth-m8`-issued tokens, so the plugin's auth adapter must be backed by
`fa-auth-m8` (the official plugin, or a custom adapter that obtains those
tokens). `@mano8/astro-ui-m8` is a normal dependency because the prompt registry
skins compose the canonical shared table from its packaged registry output.
`react`/`react-dom` are optional — only `./react`, `./hooks` and the starter
views need them; `@tanstack/react-query` is a required peer once you use
`./hooks` (`npm i @tanstack/react-query`).

## Modes

- **headless** — schemas, API wrappers, compose helper, stores; no pages.
- **starter** — injects Starlight-layout blocks / templates / composer / admin
  routes.
- **scaffolded** — `views.strategy: "scaffolded"` to own the view files.

## Quick start

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import faAuth from "@mano8/astro-auth-m8";
import faPrompt from "@mano8/astro-prompt-m8";

export default defineConfig({
  integrations: [
    react(),
    faAuth({ apiBase: "/user" }),                  // list auth BEFORE prompt
    faPrompt({ apiBase: "/prompt", apiPrefix: "/fastapi", mode: "starter" })
  ]
});
```

Wire the auth adapter once (browser entry / provider):

```ts
import { getToken } from "@mano8/astro-auth-m8/client";
import { refreshToken } from "@mano8/astro-auth-m8/api";
import {
  createFaAuthAdapter,
  setPromptAuthAdapter
} from "@mano8/astro-prompt-m8/auth-adapter";

setPromptAuthAdapter(createFaAuthAdapter({ getToken, refreshToken }));
```

## Headless usage

```ts
import { blocks, templates } from "@mano8/astro-prompt-m8/api";

const list = await blocks.list({ skip: 0, limit: 50 });
const composed = await templates.compose(1, [{ id: 2, content: "Be terse." }]);
```

## Dynamic block placeholders

Dynamic prompt blocks should include the placeholder token
`{{dynamic_content}}` in their authored block content. Compose fields collect the
runtime replacement value for that token; they do not replace the authored block
template itself.

```ts
import { DYNAMIC_CONTENT_PLACEHOLDER } from "@mano8/astro-prompt-m8/schemas";
import { templates } from "@mano8/astro-prompt-m8/api";

const authoredBlock = `Use this source text:\n${DYNAMIC_CONTENT_PLACEHOLDER}\nReturn bullets.`;

const composed = await templates.compose(1, [
  { id: 2, content: "Summarize the release notes." }
]);
```

The compose payload shape remains `{ id, content }[]`, where `id` is the prompt
block ID and `content` is the replacement value. `prompt-engine-m8` inserts that
value wherever `{{dynamic_content}}` appears in a dynamic block. Dynamic blocks
without the placeholder still use the compatibility path: the replacement value
renders as the whole dynamic block. Prefer the placeholder for new authored
dynamic blocks so surrounding instructions remain part of the final prompt.

## Security model

- Access tokens are delegated to the auth adapter and **never persisted** here.
- Service tokens are server-only: `@mano8/astro-prompt-m8/internal-server` throws
  if imported in the browser and is excluded from the client `api` barrel.
- Admin calls are gated client-side (`ForbiddenError`) before the request when
  the adapter already knows the user is not a superuser.
- Every response body is parsed through Zod; `204` responses skip parsing.
- Request URLs are protocol-pinned to http(s).

## Content Security Policy

When `guards.middleware` is enabled, the integration injects a
`Content-Security-Policy` header on every response. The `connect-src` directive
covers `'self'` and the prompt API origin (when `apiBase` is an absolute URL).
Pass additional service origins in `csp.serviceOrigin` / `csp.connectExtraOrigins`.

## shadcn views (registry)

For shadcn/Tailwind apps, this package ships a **shadcn registry** of ready-to-run
styled admin views. The headless logic stays a live dependency
(`@mano8/astro-prompt-m8/react` + `/hooks`); only the **skin** is copied into the
consumer, so views adopt the app's own tokens and are fully editable. The registry
items are pre-built into the package at `registry/r/*.json` (regenerate with
`npm run build:registry`; the output matches `shadcn build`).

### Hosting model — local file registry

The registry is consumed as a **local file** out of `node_modules` (no external host
or token). Because shadcn resolves namespaced registries (`@name/item`) over HTTP,
local consumption uses the **direct `.json` path** form of `shadcn add`. Optionally
declare the namespace in `components.json` for documentation / future HTTP hosting:

```jsonc
// components.json
"registries": {
  "@fa-m8-prompt": "./node_modules/@mano8/astro-prompt-m8/registry/r/{name}.json"
}
```

### Items

| Item | `shadcn add` (run from the consumer project root) | registryDependencies | npm dependencies | Needs `@mano8/astro-prompt-m8`? |
| :-- | :-- | :-- | :-- | :-- |
| `prompt-block-editor` | `npx shadcn add ./node_modules/@mano8/astro-prompt-m8/registry/r/prompt-block-editor.json` | `alert-dialog`, `badge`, `button`, `checkbox`, `dialog`, `dropdown-menu`, `form`, `input`, `select`, `textarea`, `@mano8/astro-ui-m8/data-table` | `@hookform/resolvers`, `lucide-react`, `react-hook-form`, `zod` | no |
| `prompt-template-editor` | `npx shadcn add ./node_modules/@mano8/astro-prompt-m8/registry/r/prompt-template-editor.json` | `alert-dialog`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `form`, `input`, `select`, `textarea`, `@mano8/astro-ui-m8/data-table` | `@hookform/resolvers`, `lucide-react`, `react-hook-form`, `zod` | no |
| `prompt-dashboard-overview` | `npx shadcn add ./node_modules/@mano8/astro-prompt-m8/registry/r/prompt-dashboard-overview.json` | `card`, `skeleton` | `lucide-react` | **yes** (`usePromptAdmin`) |
| `admin-prompt-dashboard` | `npx shadcn add ./node_modules/@mano8/astro-prompt-m8/registry/r/admin-prompt-dashboard.json` | `prompt-dashboard-overview` | — | **yes** (`PromptProvider`, `RequireSuperuser`) |

`prompt-dashboard-overview` is the admin **landing** view (overview stat cards +
activity), driven by `usePromptAdmin`. `admin-prompt-dashboard` is the full shell
that wraps it in the package's `PromptProvider` + `RequireSuperuser`; drop the
overview panel into your own shell instead if you already own the prompt admin
chrome (as fa-ui-m8 does). Both read their headless logic from the installed
package and take their strings via `labels`.

Files land under `src/components/fa-prompt/` (the items' `target`), import shadcn
primitives via `@/components/ui/*`, and pull headless logic from the installed package.
The plugin package is intentionally **not** listed in item `dependencies` (it would make
`shadcn add` try to install an unpublished package); install it yourself as a peer.
Consumers should install the shared UI block first or let `shadcn` resolve it from
`./node_modules/@mano8/astro-ui-m8/registry/r/data-table.json`, which lands under
`@/components/m8-ui/*`.

### Consumer expectations

- shadcn configured with `style: radix-nova`, `baseColor: neutral`, `cssVariables: true`,
  lucide icons, and Tailwind v4 tokens in `src/styles/global.css`.
- `@mano8/astro-prompt-m8` installed, plus its **required peer `@mano8/astro-auth-m8`** —
  prompt-engine-m8 only accepts fa-auth-m8 tokens, so a `PromptProvider` backed by a
  fa-auth adapter must be in the tree and the signed-in user must be a superuser for
  the admin views.
- Operator env: `PUBLIC_PROMPT_API_BASE` enables the prompt plugin.
- All view labels are props with English defaults — pass your own i18n strings to localize.

## Contract surface

The plugin exports explicit subpaths (`./api`, `./client`, `./schemas`,
`./auth-adapter`, `./hooks`, `./react`, `./default-ui`, `./routes`,
`./list-params`, `./compatibility`, `./middleware`, `./internal-server`). See
`package.json` for the exact list.

## Commands

- `npm run build` — `tsc` → `dist/` + `npm run build:registry`
- `npm run build:registry` — regenerate `registry/r/*.json` from `registry.json`
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest with coverage (100% on the non-React runtime)

## License

MIT

[`prompt-engine-m8`]: https://github.com/mano8/prompt-engine-m8
