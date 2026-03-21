# Media Import Fails On Non-Localhost HTTP

## Summary

On March 21, 2026, image import appeared to fail on:

- `http://my7k62:4100/en/projects`
- `http://my7k62:4100/zh/projects`

The visible symptom was:

- imported image files did not appear in the Assets panel after selection

The same workflow worked on:

- `http://127.0.0.1:4100/en/projects`

## Misleading Symptom

The issue initially looked like a rendering problem in the media card:

- `next/image` vs native `<img>`
- `thumbnailUrl` vs `url`
- image card preview CSS

Those were secondary investigations, but not the root cause of the import failure on `my7k62`.

## Root Cause

Media file storage depended on OPFS via `navigator.storage.getDirectory()`:

- `apps/web/src/services/storage/service.ts`
- `apps/web/src/services/storage/opfs-adapter.ts`

On `localhost`, OPFS was available and file persistence succeeded.

On non-localhost plain HTTP origins like `http://my7k62:4100`, OPFS was unavailable. As a result:

1. the media asset was optimistically inserted into in-memory state
2. `storageService.saveMediaAsset()` failed when trying to persist the file
3. `MediaManager.addMediaAsset()` rolled the asset back out of memory
4. the Assets panel looked empty, which made the problem look like a UI rendering bug

## Fix

Added an IndexedDB-backed file storage fallback for environments where OPFS is not supported:

- new file: `apps/web/src/services/storage/indexeddb-file-adapter.ts`
- updated adapter selection in `apps/web/src/services/storage/service.ts`

Current behavior:

- use OPFS when `OPFSAdapter.isSupported()` is true
- otherwise store media files in IndexedDB

## Validation

Headless QA verified image import on all three routes below after the fallback was added:

- `http://127.0.0.1:4100/en/projects`
- `http://my7k62:4100/en/projects`
- `http://my7k62:4100/zh/projects`

Validation signal used:

- imported `red.png`
- confirmed `hasRed: true`
- confirmed at least one rendered asset background (`bgCount: 1`)

## Tests Added

- `apps/web/src/services/storage/service.test.ts`

Assertions cover:

- guarding `navigator.storage.estimate()`
- falling back to IndexedDB-backed file storage when OPFS is unavailable

## Additional Notes

During debugging, image card rendering was also hardened:

- media cards use CSS `backgroundImage`
- image cards prefer `item.url` and fall back to `thumbnailUrl`

Those changes improve resilience, but the import failure on `my7k62` was fundamentally a storage capability issue, not a card rendering issue.
