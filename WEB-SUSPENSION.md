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
- **The Android workflows** (`android.yml`, `device-test.yml`) were not changed by the suspension. In 1.12.3 the APK packaging check now requires all 12 OCR languages.
- The `github-pages` environment and all secrets are unchanged.
- **The live v1.12.2 site was left online at first.** APK versions up to 1.12.2 download their optional OCR language packs from `https://firatnexus.github.io/shotrova/ocr-packs/`.
- **Since 1.12.3 the APK does not depend on the website.** All 12 OCR languages are built into the APK (`copyOcrPacks` in `android/app/build.gradle`), and the app makes no requests to the website.
- **The site was taken offline on 30 October 2026**, after v1.12.3 was released. GitHub Pages was turned off (`DELETE repos/firatnexus/shotrova/pages`), and https://firatnexus.github.io/shotrova/ now returns 404. No files were removed.

## Things to keep in mind while the web version is paused

- No website is published. GitHub Pages is turned off.
- **OCR packs:** since 1.12.3 the APK carries every language itself, so changing the packs no longer requires publishing the website. Users still on 1.12.2 or older can no longer download the extra packs (Turkish and English still work); every language works once they update to 1.12.3.
- **Hosting and billing:** Pages is turned off, so there is nothing hosted.

## How to restore the web version

0. Turn Pages back on: **Settings → Pages → Source: GitHub Actions**.
   CLI equivalent: `gh api -X POST repos/firatnexus/shotrova/pages -f build_type=workflow`
1. Go to GitHub → repository **Settings → Secrets and variables → Actions → Variables**, then add the variable `WEB_DEPLOY_ENABLED` with the value `true`.
   CLI equivalent: `gh variable set WEB_DEPLOY_ENABLED --body true -R firatnexus/shotrova`
2. Publish: push to `main`, or run **Actions → CI and GitHub Pages → Run workflow** on `main`.
3. Check that the `deploy` job succeeds and that https://firatnexus.github.io/shotrova/ shows the new version.
4. Optional cleanup once the web version is active again: revert the suspension commit, which removes the `WEB_DEPLOY_ENABLED` condition and this file, then remove the variable.

To pause publishing again, delete the variable or set it to anything other than `true`.
