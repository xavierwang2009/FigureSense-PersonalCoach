# FigureSense development log

## Local development — before GitHub (June 5, 2026–October 14, 2026)

- **Xavier’s idea and development:** Through his artistic swimming practice, Xavier identified a need for useful feedback between coaching sessions. He created FigureSense to use video analysis and pose detection to help swimmers review body positions, identify areas to improve, and track progress. Working locally in VS Code, he developed six core JavaScript modules, using Ballet Leg as the first test figure.
- **Source:** Xavier’s local `figuresense-simple-site` folder, supplied by the project owner. This is a retrospective summary of reported work.
- **External library:** MediaPipe provides pose detection. Practice scores are estimates, not official judging results.

## 2026-10-14 — Share the starting version and identify improvements

- **Added to GitHub:** Codex imported the supplied local files unchanged into the private `figuresense-simple` repository, to keep a baseline before sharing the app with swimmers and collecting feedback.
- **Problem reported:** On a phone, the hip, knee, and ankle points were small and difficult to place precisely with a finger.
- **Needed improvement:** Zoom and easier point adjustment. Xavier began working on the phone controls.

## 2026-10-16 — Xavier’s zoom update and Codex review

- **Xavier updated `app.js`:** Added zoom/Fit controls, zoom focus around the selected point, and drag-to-pan. His submitted code was committed separately before review adjustments.
- **Codex reviewed and adjusted:** Fixed points jumping when dragged, handling of extra fingers and cancelled gestures, keyboard movement beyond the image, and zoom positioning for portrait frames. Enlarged touch targets and zoom buttons.
- **Checks completed:** JavaScript syntax and point-control regression tests passed. A mobile-sized browser test confirmed frame capture, zoom up to 4×, and return to Fit without horizontal page overflow.
- **Still to check:** Have swimmers retry point placement on an actual phone. Real-phone usability and measurement accuracy on swimming footage remain unverified.

## 2026-10-16 — Keep results and share a report

- **Swimmer feedback:** Results disappeared on refresh; swimmers wanted to keep reviews, share them with a coach or parent, and compare progress.
- **Xavier built:** `history.js` saves scores and feedback on the device; `report.js` creates a report image with the score, five checkpoint frames and practice feedback. Updated `index.html` and `app.js` with a swimmer name, save/report buttons and a progress table.
- **Codex reviewed and adjusted:** Kept portrait frames uncropped and long feedback inside the report; included coach’s-eye deductions. Fixed review updates, storage-error messages and new-video separation. Progress comparisons now require matching saved checkpoints.
- **Checks completed:** Syntax, history/report tests and existing point-control tests passed; the updated page loaded in a browser. Xavier’s supplied files and Codex’s review changes are in separate commits.
- **Still to check:** Swimmers should save progress, refresh, compare another review and download the report on an actual phone. Saved progress excludes frames; keep the report image separately.

## 2026-10-17 — Xavier tests his Ballet Leg clip

- **Xavier reported:** MediaPipe scanned his 12-second clip in about 24 seconds and identified the right working leg. Body points generally landed on him, including a straight-up Ballet Leg, but some checkpoint selections were wrong.
- **Xavier fixed:** In `ballet-assist.js`, rejected downward reflections as flat layouts and favored a vertical thigh with a low foot for Bent Knee. In `app.js`, counted and applied only the body points needed by the selected checkpoint.
- **Codex reviewed and adjusted:** Preserved yesterday’s saved-progress fixes when merging the older `app.js` copy. Tightened Bent Knee selection to reject feet far above or below hip level and leave the moment unselected when no candidate qualifies. Hip height is only a rough water-level proxy.
- **Checks completed:** Synthetic-landmark and suggestion-count tests, existing history/report and point-control tests, and JavaScript syntax checks passed. Xavier’s submitted files and Codex’s adjustments are committed separately.

## 2026-10-18 — Comparison drawings, summary and practice plan

- **Xavier built:** Updated `app.js`, `poses.js`, `geometry.js`, `figures.js` and `index.html` with green dashed target lines, deviation gauges, a whole-figure summary and a deduplicated pool/land practice plan. Added point-based estimates for supported coach’s-eye checks, with manual checks when measurements are unavailable.
- **Codex reviewed and adjusted:** Fixed comparison lines on small thumbnails, added gauges to saved-result rows, clarified summary counts and matched check labels to what the points actually measure. Fixed height comparisons to use the same body segment in both frames and rejected zero-length segments. Kept older scoring versions separate in progress comparisons.
- **Checks completed:** Four test scripts and JavaScript syntax checks passed. A browser preview with five synthetic frames showed the summary, grouped drills, comparison drawings and result gauges without console errors. This was a code/layout check, not a new swimming-clip accuracy test.
