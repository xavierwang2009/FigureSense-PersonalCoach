# FigureSense development log

## Local development — before GitHub

- **Xavier built:** A browser-based Ballet Leg review app with video upload and playback, frame capture, editable body points, angle measurements, MediaPipe pose suggestions, and practice feedback.
- **Source:** Xavier’s local `figuresense-simple-site` folder, supplied by the project owner. Local development dates were not recorded; this is a retrospective summary of reported work.
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
