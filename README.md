# @mano8/astro-prompt-m8

![CI/CD](https://github.com/mano8/astro-prompt-m8/actions/workflows/CI.yaml/badge.svg?branch=main)

Astro integration and headless client for [`prompt-engine-m8`]. The prompt-side
analog of `@mano8/astro-media-m8`: typed Zod schemas, API wrappers for the full
prompt contract, a compose helper, optional React provider/hooks, and injectable
starter routes — so any Astro stack can drive prompt blocks/templates/composition
without re-implementing the contract.

Pinned to `prompt-engine-m8@0.0` (supported service-version range
`>=0.0.1 <0.1.0`; see `promptEngineM8` in `package.json`).

## Backend contract

This package targets the `prompt-engine-m8@0.0` API contract and was tested
against `prompt-engine-m8` service version `0.0.1`. Supported backend service
versions are `>=0.0.1 <0.1.0`.

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
tokens). `react`/`react-dom` are optional — only `./react`, `./hooks` and the
starter views need them.

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

## Contract surface

The plugin exports explicit subpaths (`./api`, `./client`, `./schemas`,
`./auth-adapter`, `./hooks`, `./react`, `./default-ui`, `./routes`,
`./list-params`, `./compatibility`, `./middleware`, `./internal-server`). See
`package.json` for the exact list.

## License

MIT
