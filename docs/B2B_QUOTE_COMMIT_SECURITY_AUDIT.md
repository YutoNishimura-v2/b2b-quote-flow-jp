# B2B Quote Flow JP Commit Security Audit

Last updated: 2026-06-14

## Repo root

Outer repo:

```text
/workspaces/b2b-quote-flow-jp
```

App repo:

```text
/workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp
```

The workspace contains a nested app git repository. The outer repo tracks the app directory as a gitlink.

## Current HEAD

Final outer HEAD after resolving the gitlink structure should be read with:

```bash
git rev-parse HEAD
```

The final assistant report for this audit includes the exact HEAD observed after the last amend. Keeping the exact hash inside this file would make the report stale every time this file is amended.

Inner app repo HEAD before removing nested `.git`:

```text
c01dd28214000435c697b28d5d7185f5a156bb18 Implement Dawn B2B quote proof
```

Because this report is included in the final outer amend, confirm the final outer HEAD after any subsequent amend with:

```bash
git rev-parse HEAD
```

## Gitlink/submodule structure audit

The workspace initially contained two git repositories:

```text
/workspaces/b2b-quote-flow-jp/.git
/workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp/.git
```

The outer repo had the GitHub remote:

```text
origin https://github.com/YutoNishimura-v2/b2b-quote-flow-jp
```

The inner app repo had no remote. The outer repo tracked `b2b-quote-flow-jp` as a gitlink:

```text
160000 commit c01dd28214000435c697b28d5d7185f5a156bb18 b2b-quote-flow-jp
```

There was no `.gitmodules` file, and `git submodule status` reported no submodule mapping for `b2b-quote-flow-jp`. This means the app directory would not be pushed as normal source files from the outer repo.

Decision:

```text
The outer repo is the canonical repo.
```

Reason:

- The outer repo is the Codespaces/GitHub repo root.
- The outer repo has the GitHub `origin`.
- The inner repo has no remote.
- There is no `.gitmodules`.
- There is no stated intent to use submodules.

Resolution:

- Recorded inner app HEAD: `c01dd28214000435c697b28d5d7185f5a156bb18`.
- Removed the gitlink from the outer index with `git rm --cached -r b2b-quote-flow-jp`.
- Removed only `b2b-quote-flow-jp/.git`; app files were not deleted.
- Added the app directory as normal files in the outer repo.
- Amended the outer commit.

Final confirmation:

```text
git ls-tree HEAD b2b-quote-flow-jp
040000 tree ... b2b-quote-flow-jp
```

The app is now tracked as ordinary files by the outer repo. Example tracked paths include:

- `b2b-quote-flow-jp/package.json`
- `b2b-quote-flow-jp/app/...`
- `b2b-quote-flow-jp/extensions/...`
- `b2b-quote-flow-jp/prisma/...`
- `b2b-quote-flow-jp/shopify.app.toml`

Only one `.git` directory remains:

```text
./.git
```

## Files in the recent commit

Outer commit now contains:

- `b2b-quote-flow-jp/` app source files as normal tracked files.
- `docs/B2B_QUOTE_DAWN_PROOF_SUCCESS.md`.
- `docs/B2B_QUOTE_FLOW_JP_HANDOFF_SINGLE_REPORT.md`.
- `docs/B2B_QUOTE_COMMIT_SECURITY_AUDIT.md`.

The app source in the outer commit primarily contains:

- Shopify React Router app source under `app/`.
- Theme App Extension source under `extensions/b2b-quote-button/`.
- Prisma schema and migrations under `prisma/`.
- package metadata and app configuration files.

## Secret/local DB/generated file audit

No tracked files matched the dangerous generated/local file patterns:

- `.env`
- `.env.*`
- `dev.sqlite`
- `*.sqlite`
- `node_modules/`
- `.shopify/`
- `dist/`
- `build/`
- `.cache/`
- `.turbo/`

Local filesystem does contain untracked local/generated directories and files such as:

- `b2b-quote-flow-jp/node_modules/`
- `b2b-quote-flow-jp/.shopify/`
- `b2b-quote-flow-jp/prisma/dev.sqlite`

These are ignored and not tracked by the app commit.

Keyword scan found source references to secret/token-related identifiers, but no committed secret values were identified. The references are code/config placeholders such as environment variable names, session model fields, Shopify auth code, dependency metadata, and documentation text.

## `.gitignore` coverage

Confirmed or added ignore coverage for:

```gitignore
# dependencies
**/node_modules/

# env / secrets
**/.env
**/.env.*
!**/.env.example

# local databases
**/dev.sqlite
**/*.sqlite
**/*.sqlite-journal

# Shopify local state
**/.shopify/

# build/cache
**/build/
**/dist/
**/.cache/
**/.turbo/
**/.vite/
```

The outer repo did not have a `.gitignore`, so one was added. The app repo `.gitignore` was tightened and `.env.example` was explicitly allowed.

## Fixes made during audit

- Added outer repo `.gitignore`.
- Updated app repo `.gitignore` to cover dependencies, secrets, local SQLite DBs, Shopify local state, and build/cache output.
- Hardened quote request `productUrl` normalization so only `http:` and `https:` URLs are persisted.
- Escaped the storefront `data-product-url` attribute in the Theme App Extension block.
- Amended the former inner app repo commit before flattening because it had no remote and the fix was part of safely freezing the Dawn proof state.
- Flattened the nested gitlink structure so the outer repo tracks app files directly.
- Amended the outer repo commit after flattening.

## Author email

Current commit metadata uses:

```text
YutoNishimura-v2 <yutonishimurav2@g.ecc.u-tokyo.ac.jp>
```

This was not changed automatically. If this repository will be public and that email should not be exposed, change the git author to a GitHub noreply email and amend before pushing.

## Verification results

Run from:

```text
/workspaces/b2b-quote-flow-jp/b2b-quote-flow-jp
```

Results:

```text
npm run lint: passed
npm run typecheck: passed
npm run build: passed
```

The build emitted React Router future flag warnings only. No lint, typecheck, or build errors were found.

## Final status after gitlink cleanup

Expected final outer status:

```text
## main...origin/main [ahead 1]
```

Expected tracked generated/secret file check:

```text
No tracked .env, SQLite DB, node_modules, .shopify, build, dist, cache, or turbo files.
```

Local filesystem still contains ignored local/generated files such as `node_modules/`, `.shopify/`, and `prisma/dev.sqlite`; these are not tracked.

## Remaining risks

- App Proxy signature verification is not strict enough for production. Current proof behavior intentionally remains intact, but production should require trusted App Proxy signatures on the storefront proxy route.
- The direct `/api/b2b-quote/requests` route remains useful for local/dev verification but should not be treated as a production-trusted storefront endpoint without additional controls.
- `shopify.app.toml` still contains placeholder URLs such as `https://example.com`; production deploy must replace these through the proper Shopify config flow.
- The app uses local SQLite for development. Production DB is not configured.
- Root login form Bad Request remains a known issue.
- Draft Order, PDF, Billing, email notification, and admin status update improvements are still intentionally out of scope.

## Human follow-up checklist

- Confirm whether the outer repo gitlink/submodule structure is intentional. If not, decide whether to flatten the app repository or formally configure a submodule.
- Before pushing, run `git status --short` in both the outer repo and the app repo.
- Confirm no real environment files exist outside the searched depth before any public push.
- If any real Shopify secret was ever committed in another branch or earlier local commit, rotate it. This audit did not identify committed secret values in the current HEAD.
- Verify production Shopify app URLs before deployment and avoid committing Codespaces tunnel URLs as fixed production config.
