# Changelog

All notable changes to `@mano8/astro-prompt-m8` are documented here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The major version tracks the supported `prompt-engine-m8` **API contract**, not
just this package's own surface: a backend contract repoint is always a major.

## [Unreleased]

### Changed

- **The fleet gate exempts one authorization specifier** (remediation `W7.7`,
  decision 4). `scripts/verify-fleet-gates.mjs` is carried byte-identically by
  all four plugins, so a fleet-wide rule change lands in all four or in none.
  `no-cross-plugin-import` now permits exactly
  `@mano8/astro-auth-m8/authorization` — the pure, framework-neutral mirror of
  `auth_sdk_m8/authorization.py` — so a plugin can meet `RBAC-06`, one role
  hierarchy, by importing it rather than re-implementing it. Every other
  subpath of the auth peer stays refused. A new `authorization-purity` gate
  makes that exemption conditional: in a package that uses it, it walks the
  module's import closure and fails on React, on any bare dependency other than
  `zod`, or on any read of a runtime global. This package imports no
  authorization module today, so the second gate is inert here and nothing in
  its behaviour, surface or dependencies changes; it carries the rule so the
  fleet stays one rule.

- **The required auth peer is raised to `@mano8/astro-auth-m8` `^2.3.0`** in
  both `peerDependencies` and `devDependencies`. `2.3.0` coordinates the two
  token-refresh paths behind one single-flight guard; below it, a page mounting
  both paths against one expired token can issue two rotations, which
  `fa-auth-m8` reads as token reuse and answers by revoking every session for
  the account. This plugin reaches that path through
  `installFaAuthBrowserAdapter`, so it is behaviour this package depends on
  rather than one it merely tolerates. The previous range already resolved
  `2.3.0` on a fresh install; the floor states the requirement.

## [2.0.0] - 2026-08-23

Realigns the client with `prompt-engine-m8@2.0.0`'s server-driven list contract
and closes the compatibility, request-schema and consumer-boundary gaps the
`astro-prompt-canonical-frontend-alignment-plan-2026-08-18` audit found under
the previous release's green suite. **A `1.1.x` client cannot correctly drive a
`prompt-engine-m8@2.0.0` service**: it still narrows every list call down to
`skip`/`limit`, its `/meta` preflight is unwired, and it still sends `GET` for
two operations the service has already removed as deprecated aliases. Upgrade
the client together with the service.

**Why this is a major and not a minor.** Two reasons, either sufficient on its
own. First, the versioning rule at the head of this file: the major tracks the
supported `prompt-engine-m8` **API contract**, and this release repoints that
contract from `>=1.0.0 <2.0.0` to `>=2.0.0 <3.0.0` — a `2.x` service is now the
only service this client accepts, and its `/meta` preflight renders
`state-error` against a `1.x` one. Second, the `Breaking` section below is a
wire-format change, not an internal one. Shipping either under a minor would
have let a host on `^1.1.1` pick the release up through its caret range and
break at runtime; at `2.0.0` a host must repoint deliberately, together with
its service.

### Breaking

- **`addTemplateBlock` and `setTemplateBlockPosition` now send `POST` and `PUT`
  (`C17`).** Both previously sent `GET` for a state-mutating operation — a
  `GET` that mutates is cacheable, prefetchable and link-followable, and the
  client's own tests pinned the vulnerable verb inside `toMatchObject`
  assertions rather than catching it. `prompt-engine-m8@2.0.0` deleted the
  deprecated `GET` aliases for these two paths before this release was
  published, so a `1.1.x` client talking to a `2.0.0` service now gets `405` on
  every template-block reorder and attach — there is no compatibility window to
  preserve; the fix is required, not additive.

### Added

- **True bulk export over the filtered set (`A-C8`).** The block and template
  editors' "Export all" button now calls `GET /prompt-block/export/` /
  `GET /prompt-template/export/` — a second, deliberately unpaginated read
  carrying the same `q`/`csrc`/`sort`/`order`/`f` filter as the list route —
  instead of bundling only the one page the table happened to be showing
  (`C7`'s interim fix, which relabelled the button "Export page" rather than
  claim more than it did). `exportFilteredBlocks`/`exportFilteredTemplates` in
  `runtime/api/transfer.ts`, wired through `usePromptTransfer`'s
  `exportFilteredBlocksMutation`/`exportFilteredTemplatesMutation`.
  `toServiceExportQuery` in `listParams.ts` is `toServiceListQuery` without the
  offset pair, since the export routes accept none of it. A response past the
  service's `MAX_EXPORT_SIZE` cap sets `truncated: true`, surfaced as a toast
  naming the exported/total counts rather than silently dropping rows.
- **Server-driven list contract for blocks and templates (`C7`).** The prompt
  block and template editors now forward the full list vocabulary —
  `q`/`csrc`/`sort`/`order`/`f` alongside `skip`/`limit` — to
  `prompt-engine-m8`'s list endpoints instead of fetching the first 100 rows
  and filtering/sorting/paginating them in the browser. Sortable columns are
  pinned to the service's declared vocabulary with
  `satisfies readonly PromptBlockSortField[]` so an unsupported sort id fails
  at compile time rather than silently reaching the wire. `rowCount` now comes
  from the service's **filtered** count, matching the paginator to the actual
  result set past the previous 100-row ceiling.
- **Paging fixture proving the page boundary (`C8`).** `serverDrivenPaging.test.tsx`
  exercises the editors against a fixture larger than one page, asserting the
  client-side `filteredBlocks`/`pagedBlocks`/`filteredTemplates`/
  `pagedTemplates` substitute is gone rather than merely unused, and that a
  second page of results is reachable and rendered.
- **`/meta` compatibility preflight wired at runtime (`C9`).** `src/runtime/api/meta.ts`
  is new: a `GET /meta` wrapper feeding the existing (previously dead)
  `assertPromptEngineM8Compatibility` from `src/runtime/compatibility.ts`.
  `PromptProvider` now runs the preflight once per session and renders
  `state-error` / `state-unauthorized` on a contract mismatch instead of
  silently proceeding against an incompatible service.
- **`CategoryCreateSchema` now requires `type` (`H2`, `D-C1`).** The strict
  client schema previously validated `{ name }` alone and looked complete while
  omitting the one field `prompt-engine-m8`'s `CategoryCreate` has never
  defaulted — every category create from the UI was a `422` the client-side
  test suite could not see, because it mocked the transport rather than the
  service's model. Resolved on the client rather than the server per `D-C1`:
  the UI already knows whether it is filing a block or a template category, so
  a server-chosen default would be a guess.
- **`ping()` now requests `/ping` instead of the unmounted API-prefix root
  (`H4`).** The server-only liveness check requested `{apiBase}{apiPrefix}/`,
  which `prompt-engine-m8` never mounts; the dependency-free liveness route is
  `{API_PREFIX}/ping`. The preflight's liveness check now resolves instead of
  404ing.
- **Contract-fidelity tests (`C6`).** `api.test.ts` and `schemas.test.ts` gained
  the test class the fleet lacked: list query strings and request payloads
  asserted against `prompt-engine-m8`'s own declared vocabulary and required
  fields, not only against a hand-written mock — the shape of test that would
  have caught `H2` and `H6` inside the previously fully-covered suite.
- **Install-from-tarball smoke (`C10`).** `scripts/verify-tarball-install.mjs`
  packs the plugin, installs it into a fresh standalone Astro fixture, and
  builds — catching missing `files`, bad `exports` and registry-path errors
  that `npm pack --dry-run` misses.

### Changed

- **`D-C2` — the admin-gated dashboard views widen their client-side floor
  from `is_superuser` to the service's `require_admin` floor.** The service
  raised `/dashboard/*` from `require_writer` to `require_admin` in `2.0.0`;
  the client previously gated all four overview calls on
  `admin: true, adminRole: "is_superuser"`, which was stricter than the
  service and locked out an ADMIN-tier user the service now serves. Fail-closed
  before this change, so not a hole — but the decision recorded in the plan now
  reaches the client that enforces it.
- **`apiPrefix` default corrected (`C10`).** Aligned with the path
  `prompt-engine-m8` actually mounts rather than a guessed default, closing the
  other half of the `H4`-shaped defect class this release fixes for `ping()`.
- **`@mano8/astro-ui-m8` and `@mano8/astro-auth-m8` peer/dev ranges updated**
  to `^1.4.2` and `^2.1.0` respectively, matching the published versions this
  release was built and tested against.
- **Contract metadata realigned**: `promptEngineM8.contract` is now
  `"prompt-engine-m8@2.0.0"`, `testedServiceVersion` is `"2.0.0"`,
  `serviceVersionRange` is `">=2.0.0 <3.0.0"` (`A35`/`A36`).

### Fixed

- Lockfile refreshed to resolve the committed `package-lock.json` drift against
  `package.json` (`@mano8/astro-ui-m8@^1.4.0` → `^1.4.2`,
  `@mano8/astro-auth-m8@^1.5.0` → `^2.1.0`) that made `npm ci --legacy-peer-deps`
  fail `EUSAGE` on every CI job — install, not only the security gate, was the
  actual blocker (`H19`, `C21`). The same refresh clears the reported advisory
  set (`brace-expansion`, `js-yaml`, `nanoid`, `postcss`, `undici`) with no
  `--force` and no declared-range change.

## [1.1.1] and earlier

Predates this changelog. See Git history for `@mano8/astro-prompt-m8` versions
`1.1.1` and earlier.
