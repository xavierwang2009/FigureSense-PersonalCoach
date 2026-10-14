# FigureSense development log

This log records the local starting point and subsequent work in this repository.
Dates use America/Chicago time. Entries about earlier local work are retrospective;
they are not separate Git commits or a verified day-by-day development timeline.

## Before the GitHub import — local development

**Developer:** Xavier, as reported by the project owner.  
**Dates:** Not yet recorded.  
**Starting material:** The supplied `figuresense-simple-site` folder.

The project owner reports that Xavier developed the core FigureSense features on
his local machine before supplying this folder for GitHub publication. The folder
contains a browser-based Ballet Leg review application. The following describes
its source-code components at import, not the order or dates on which each was
written and not a file-by-file verification of authorship.

| Core element | Implementation present in the supplied files |
|---|---|
| Video review | Local video selection, playback, frame capture and review controls in `app.js` and `index.html` |
| Figure definitions | Ballet Leg checkpoints, measurement requirements, review items and drill descriptions in `figures.js` |
| Measurement | Joint angles and angles relative to a marked waterline or vertical in `geometry.js` |
| Manual point review | Point placement and editing connected to captured frames in `app.js` |
| Pose suggestions | MediaPipe loading, still-frame detection and video sampling in `autoscan.js` |
| Suggested figure moments | Working-leg selection, sequence suggestions and conversion of pose landmarks to review points in `ballet-assist.js` |
| Practice results | Checkpoint and figure practice-score calculations and issue ranking in `geometry.js`, with results displayed by `app.js` |
| Position illustrations | Small position drawings in `poses.js` |

MediaPipe supplies the external pose-detection capability. Its inclusion does not
mean a new pose model was trained for this project. Practice scores are estimates,
not official judging results. The import inspection checked source contents and
local script references; it did not establish accuracy on swimming footage.

Earlier dates, test observations, source reuse and assistance details can be added
when Xavier provides his own records. This entry makes no claim that all code was
written independently or without assistance.

## 2026-10-14 — Start the figuresense-simple repository

- Requested action: create a fresh repository using the supplied local project.
- Repository: [xavierwang2009/figuresense-simple](https://github.com/xavierwang2009/figuresense-simple), private at creation.
- Import performed by: OpenAI Codex through GitHub, at the project owner's request.
- Added the supplied README, then imported the application files without source edits.
- Application import commit: [fe3692e](https://github.com/xavierwang2009/figuresense-simple/commit/fe3692e746e17b82f12acf6193f4c0dea1a6cd49).
- Imported files: `README.md`, `index.html`, `app.js`, `figures.js`, `geometry.js`, `poses.js`, `autoscan.js`, `ballet-assist.js`.
- No earlier repository commits were imported. Git history starts with the actual GitHub setup and import.
- Checks: confirmed all eight files were present and local JavaScript references resolved. App behavior was not tested during import.

## 2026-10-14 — Document the local starting point

- Requested action: document the core features developed locally before the import.
- Documentation prepared by: OpenAI Codex from the project owner's statement and an inspection of the supplied source files.
- Added this log and a README link. No application code changed.
- Earlier local work is marked retrospective with dates not yet recorded.

## Future work entry

Copy this section for each actual work session:

### YYYY-MM-DD — Change or experiment

- Developer / contributor:
- Goal:
- Files changed and what changed:
- Technical decision and reason:
- External code, documentation or assistance used:
- Test input and expected result:
- Observed result, including problems:
- Evidence: commit, test output or permitted screenshot:
- Remaining work:
