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

## Next testing step — Xavier’s own Ballet Leg clips

- **Footage recorded:** Xavier performing the Ballet Leg figure.
- **Xavier will test:** Automatic detection of the five moments and body points; which coach’s-eye items can be measured automatically from the video; and whether the whole-figure summary and practice suggestions match what the clip shows.
- **What to record:** Missed or misplaced points, manual corrections needed, items that still require human review, and unclear or inaccurate suggestions.
- **Pending:** Testing results and any resulting code updates. Automatic measurement of coach’s-eye items is a planned investigation, not a completed feature.
