# Changelog

All notable changes to `@mano8/astro-prompt-m8` are documented here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The major version tracks the supported `prompt-engine-m8` **API contract**, not
just this package's own surface: a backend contract repoint is always a major.

## [Unreleased]

## [2.2.1] - 2026-09-26

**Patch.** Tracks the published `@mano8/astro-ui-m8` `1.5.2` and
`@mano8/astro-auth-m8` `2.7.1` (`B39-astro-ui-changelog-release`, finding
`G38`). The only shipped change is `package.json`'s floors. The contract
stays `prompt-engine-m8@2.1.0`, range `>=2.1.0 <3.0.0`, and the tested
service version stays `2.2.1`.

### Added

- **A lock that does not pin every package fails the build**
  (`B34-npm-lock-integrity-guard`, finding `G34`(b)).
  `scripts/verify-lock-integrity.mjs` (`npm run verify:lock-integrity`)
  refuses a `package-lock.json` below `lockfileVersion` 3, or one with any
  entry that lacks `integrity` or `resolved`, carries a non-`sha512` hash,
  resolves outside `https://registry.npmjs.org/`, or is a link or `file:`
  source, and names every offending key. `npm ci` installs an entry with no
  `integrity` without checking a hash and says nothing, which is how `G33`
  went unseen. CI runs it before `npm ci` in every job that installs.
  `tests/lock-integrity.test.ts` proves each refusal against a fixture lock
  and asserts this repository's own lock passes. The script is
  dependency-free and byte-identical in the fleet's six npm repositories.
  This lock already passed; the fixtures prove the red path. Only
  `package.json`'s `scripts` gains an entry, so no release is owed.

### Changed

- **`[Unreleased]` may carry work that ships no release**
  (`B34-npm-lock-integrity-guard`). `tests/changelogVersionParity.test.ts`
  asserted an empty `[Unreleased]` on every commit. The `prompt-engine-m8`
  A32 test it ports asserts that only as a post-fold snapshot, and says
  mid-wave content is normal. The standing rule made the bullet above
  impossible to write. The test now asserts what a fold must never do:
  `[Unreleased]` heads the file, and no bullet under it repeats one a
  released section already carries.
- `@mano8/astro-ui-m8` floor `^1.5.1` → `^1.5.2` (`dependencies`) and
  `@mano8/astro-auth-m8` `^2.7.0` → `^2.7.1` (`peerDependencies` and
  `devDependencies`, still equal), the newest published releases (§0.5's
  explicit-pin rule). The lock moves those two entries, each with its
  registry `resolved` and `sha512` `integrity`.

### Security

- **The publish job verifies the lock before it installs**
  (`B37-publish-lock-guard`, finding `G36`). `B34` guarded every `CI.yaml`
  job but not the one that holds `id-token: write` and builds the tarball,
  and the environment's `tag:v*` rule matches a tag by name, not by where it
  points. `npm-publish.yml` now runs `npm run verify:lock-integrity` before
  `npm ci`, and `tests/publish-workflow.test.ts` holds the order.

## [2.2.0] - 2026-09-26

Tracks the published `prompt-engine-m8` `2.2.1` (`B31-plugin-tracking-tail`,
finding `G32`). **Renumbered from the unpublished `2.1.1`**, the Wave 6c
one-bump rule: this section carries everything `2.1.1` did plus the tracking
move, and `2.1.1` never ships. A minor rather than a patch because an exported
compatibility constant changes value, the fleet's tracking-release convention.
The contract stays `prompt-engine-m8@2.1.0` and the range `>=2.1.0 <3.0.0`.

### Added

- `tests/compatibility.test.ts` now locks the published `promptEngineM8`
  package metadata (`contract`, `testedServiceVersion`, `serviceVersionRange`)
  against the `compatibility.ts` constants it must mirror — the vitest twin of
  the `scripts/verify-contract-drift.mjs` script gate, so a manifest/runtime
  drift is caught in the ordinary test run as well as in the drift script
  (`B12-manifest-runtime-parity-lock`).

### Changed

- `PROMPT_ENGINE_M8_TESTED_SERVICE_VERSION` and `package.json`'s
  `promptEngineM8.testedServiceVersion` move `2.1.0` → `2.2.1`. Read from
  `v2.1.0` to `v2.2.1` on the service, the published
  `contracts/openapi.json` differs in `info.version` alone, so no route,
  schema or list vocabulary moved; `2.2.x` carries the Debian patch layer, a
  UTC PostgreSQL session clock and typing fixes.
- `contracts/prompt-engine-m8.openapi.json` is refreshed from the `v2.2.1`
  tag with `verify:contract-drift --write`. The diff is `info.version`
  `2.1.0` → `2.2.1`, and the gate reads no drift.
- `README.md` and `REPOSITORY_CONTEXT.md` name the `2.1.0` contract, the
  `>=2.1.0 <3.0.0` range and the tested `2.2.1`. Both had still read
  `prompt-engine-m8@2.0.0` / tested `2.0.0` / `>=2.0.0` since `2.1.0` moved
  the contract.
- The preview gallery's `/meta` stub (`fixtures/preview`) answers contract
  `2.1.0` / service `2.2.1`. It had answered `2.0.0`, which the exact-match
  contract check refuses, so the gallery's preflight failed against its own
  stub.
- Raised the `@mano8/astro-auth-m8` floor from `^2.4.1` to `^2.7.0` in both
  `peerDependencies` and `devDependencies`, matching the version this package
  is actually tested against on the published registry (`G15` residual).
  The unpublished `2.1.1` had raised it to `^2.6.0`; `2.2.0` takes it to the
  `2.7.0` tracking release (`fa-auth-m8` `2.2.3`), published before this one
  (`B31-plugin-tracking-tail` leg 2). `package-lock.json` resolves the `2.7.0`
  tarball.

### Security

- **npm is reached only from a published release**
  (`B30-pre-publish-hardening` leg 5, finding `G25`). `npm-publish.yml` ran
  `npm publish` on any `workflow_dispatch`, from any branch, into an `npm`
  environment with no protection. A dispatch now
  runs `npm publish --dry-run`; a release fails unless its tag, with the `v`
  stripped, is `package.json`'s `version`; so the tree this release is
  tagged from carries the fixed workflow.
  `tests/publish-workflow.test.ts` locks each rule. The operator's `v*` tag
  policy on the `npm` environment is the platform half of the same rule.

## [2.1.0] - 2026-08-30

Additive API release, paired with `prompt-engine-m8@2.1.0`. **Install the two
together** — this release moves the contract axis, so it does not accept a
`2.0.0` service and a `2.0.0` client does not accept a `2.1.0` one.

Three things landed on `2.0.0` after it was published and none is a release of
its own: the `A-C8` bulk-export surface, the auth peer floor moving with the
fleet, and the role hierarchy this package used to restate now being imported.
`C22`'s changelog/version parity gate is what requires them to be released
rather than left on an already-published number.

> An earlier draft of this section described the release as "documentation and
> dependency-floor" with "no published API surface changes". That was wrong:
> `A-C8`'s export wrappers ship in it, and their entries had been written into
> the already-published `## [2.0.0]` section (`G14`). Both are corrected here —
> the entry is moved down into this section unchanged, and the summary now
> describes what the release actually contains.

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

### Changed

- **BREAKING — the supported contract moves to `prompt-engine-m8@2.1.0`**
  (`B20`, option (a)). `PROMPT_ENGINE_M8_CONTRACT_VERSION`,
  `PROMPT_ENGINE_M8_TESTED_SERVICE_VERSION` and
  `PROMPT_ENGINE_M8_MIN_SERVICE_VERSION` all move to `2.1.0`, and the
  `promptEngineM8` metadata block in `package.json` follows
  (`serviceVersionRange` `>=2.1.0 <3.0.0`). The entry above is the reason: this
  package now *calls* the export routes, and `A-C8` had shipped them on both
  sides while leaving the contract axis on `2.0.0`. A host running the
  published `prompt-engine-m8:2.0.0` image therefore passed
  `assertPromptEngineM8Compatibility` cleanly and then `404`ed on "Export all"
  — `H12` re-formed one release later, the exact defect `C17` spent a step
  closing. The axis is compared by **exact string equality**, so the mismatch
  is now refused at preflight, with the reason naming both versions, rather
  than surfacing as a broken button. `contracts/prompt-engine-m8.openapi.json`
  is refreshed from the service's published `2.1.0` artifact, so
  `verify:contract-drift` gates against the release this client actually
  targets.

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
  `zod`, or on any read of a runtime global. It is no longer inert here: this
  package now imports that module (below), so the purity of the fleet's one
  hierarchy is verified on every build of this repository too.

- **The required auth peer is raised to `@mano8/astro-auth-m8` `^2.4.0`** in
  both `peerDependencies` and `devDependencies`. Two reasons stack and the floor
  is the higher. `2.3.0` coordinates the two token-refresh paths behind one
  single-flight guard; below it, a page mounting both paths against one expired
  token can issue two rotations, which `fa-auth-m8` reads as token reuse and
  answers by revoking every session for the account. This plugin reaches that
  path through `installFaAuthBrowserAdapter`, so it is behaviour this package
  depends on rather than one it merely tolerates. `2.4.0` is then the release in
  which `@mano8/astro-auth-m8/authorization` becomes a **supported** import
  surface rather than an internal module this package happens to be able to
  reach — which the very next entry makes load-bearing, since `authAdapter.ts`
  now imports its hierarchy from exactly that specifier. Below `2.4.0` this
  package would be depending on a promise the peer had not yet made. The
  previous range already resolved these on a fresh install; the floor states the
  requirement.

- **This package no longer states the role hierarchy itself** (remediation
  `W7.7`'s named follow-up, decision 4). `src/runtime/authAdapter.ts` held a
  third copy of the M8 role vocabulary — `PROMPT_ROLE_ORDER` written out by
  value, and a `hasMinimumPromptRole` that compared indices into it — pinned by
  no agreement test at all, where `astro-reparto-m8`'s copy at least had one.
  Both now come from `@mano8/astro-auth-m8/authorization`, the one specifier
  the widened `C12` gate permits: `PROMPT_ROLE_ORDER` **is** the peer's
  `ORDERED_ROLES`, and `hasMinimumPromptRole` is a string-shaped seam over its
  `hasMinimumRole` — it keeps taking plain strings, because the claims reaching
  this plugin come from a backend that may be newer than the client and from a
  host-configured `adminRole`, and an unrecognised role still answers `false`.
  **Nothing in the published surface moves**: both names, both signatures and
  every answer they give are what `2.0.0` shipped, and `tests/runtime.test.ts`
  keeps the behavioural cases and adds one asserting by *identity* that
  `PROMPT_ROLE_ORDER` is the peer's list, so a re-fork fails the day it lands
  rather than drifting quietly. The auth peer is already a required
  `peerDependency`, so the import adds no install a consumer did not owe; the
  peer's *runtime* — its token store, refresh path and React layer — is still
  never statically imported, which is why `createFaAuthAdapter` still takes
  injected bindings.

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
