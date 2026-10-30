# Web version — temporarily suspended

**Suspended on:** 30 October 2026
**Status:** paused, not removed. Android is the active development priority.
**Last web deployment:** v1.12.2 (commit `99456f8`, 30 October 2026), still served at https://firatnexus.github.io/shotrova/

## What was disabled

- **Automatic GitHub Pages publishing** in `.github/workflows/ci.yml` ("CI and GitHub Pages"):
  - the `actions/upload-pages-artifact` step in the `test` job, and
  - the whole `deploy` job (`actions/deploy-pages`).

  Both now run only when the repository variable `WEB_DEPLOY_ENABLED` is `true`. That variable is not set, so pushes to `main` and manual `workflow_dispatch` runs no longer publish anything.
- There were no scheduled (cron) web jobs and no other hosting providers to suspend.

## What was deliberately kept

- **All web source code, assets and configuration:** `src/`, `public/` (icons, fonts, OCR data, `ocr-packs/`), `index.html`, `vite.config.ts`, `package.json`, `package-lock.json`, `capacitor.config.json`, the PWA manifest and service worker build, `docs/` and `docs/DEPLOY.md`. No files or dependencies were removed or moved.
- **The web build and every test in CI.** The Android app is the same web code bundled by Capacitor (`webDir: dist`), so `npm run build`, unit tests, OCR tests, Playwright E2E tests and the subpath build check still run on every push and pull request.
- **The Android workflows** (`android.yml`, `device-test.yml`) are unchanged.
- **GitHub Pages hosting configuration** (Settings → Pages, source "GitHub Actions"), the `github-pages` environment and all secrets are unchanged.
- **The live v1.12.2 site stays online on purpose.** The Android app downloads its optional OCR language packs from `https://firatnexus.github.io/shotrova/ocr-packs/` (`BRAND.webUrl` in `src/config/brand.ts`, `packUrl()` in `src/ocr/packs.ts`). Unpublishing the site would break those downloads in installed APKs.

## Things to keep in mind while the web version is paused

- The published site is frozen at v1.12.2. It will not pick up new changes, including fixes.
- **OCR packs:** if an Android release changes `public/ocr-packs/` or the pack list or checksums in `src/ocr/packs.ts`, the frozen site will serve the old files and the app's integrity check will reject them. Before shipping such a change, either publish once (see below) or host the packs somewhere else.
- **Hosting and billing:** GitHub Pages is free for this public repository, so there is no cost while it is paused. If you later decide to take the site fully offline, first move the OCR packs (see above). Then turn off Pages under Settings → Pages; this cannot be undone from the workflow and removes the published site.

## How to restore the web version

1. Go to GitHub → repository **Settings → Secrets and variables → Actions → Variables**, then add the variable `WEB_DEPLOY_ENABLED` with the value `true`.
   CLI equivalent: `gh variable set WEB_DEPLOY_ENABLED --body true -R firatnexus/shotrova`
2. Publish: push to `main`, or run **Actions → CI and GitHub Pages → Run workflow** on `main`.
3. Check that the `deploy` job succeeds and that https://firatnexus.github.io/shotrova/ shows the new version.
4. Optional cleanup once the web version is active again: revert the suspension commit, which removes the `WEB_DEPLOY_ENABLED` condition and this file, then remove the variable.

To pause publishing again, delete the variable or set it to anything other than `true`.
