# FigureSense — original MVP (superseded)

> This page documents the first prototype (`app.js`, `style.css`), which the current app replaced. It is kept for reference only: its setup, upload and usage steps no longer apply. For the current app see the [README](../README.md).

An experimental browser-based MVP for reviewing above-water artistic-swimming checkpoints. Select a training group and figure family, load a video, capture key frames, verify landmarks, and receive geometric measurements and practice suggestions.

**Status: human-assisted prototype, not a validated AI judge.** Automatic critical-frame selection, official scoring, and group-specific eligible-figure lists are not implemented. No swimmer video was provided for end-to-end validation of this release.

## Quick start

No npm install, paid AI subscription, API key, database, or dedicated GPU is required. Use a recent browser supporting JavaScript modules, Canvas, WebAssembly, and your video's codec. Internet access is needed for fonts and optional AI model downloads.

1. Extract this ZIP.
2. Open a terminal inside the extracted `figuresense` directory.
3. With Python 3 installed, run:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows, use `py -m http.server 8000 --bind 127.0.0.1` if needed.

4. Open http://localhost:8000 in your browser.
5. Stop the server with Ctrl+C when finished.

Use the local HTTP server rather than double-clicking `index.html`; module and AI loading can fail under `file://`.

## Upload to GitHub

1. Create a repository, for example `figuresense`. Choose public/private deliberately.
2. Unzip this package first. Upload the **contents** of its `figuresense` folder using GitHub's Add file → Upload files. Do not upload only the ZIP or nest the app one folder too deep.
3. Confirm `index.html`, `app.js`, `style.css`, and `README.md` appear at repository root. Include `.gitignore` and `.nojekyll` if your file picker shows hidden files.
4. Commit the upload. No credentials or original platform hosting metadata are included.

Optional command-line route, from the extracted directory (replace the repository URL):

```bash
git init
git add .
git commit -m "Initial FigureSense MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/figuresense.git
git push -u origin main
```

Authenticate using GitHub's supported sign-in or credential manager. Never paste tokens into source files.

### Optional: publish with GitHub Pages

Publishing is separate from uploading the source. Under repository Settings → Pages, choose **Deploy from a branch**, then `main` and `/(root)`, and Save. Open the URL shown by GitHub when deployment finishes. No build step is needed.

Treat the published site as public unless you have explicitly configured and verified access restrictions; a private repository alone is not a privacy guarantee for Pages. Do not commit athlete videos, consent forms, exported reviews, or personal information. Pages availability depends on your account/repository configuration.

Official instructions: [publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [creating a Pages site](https://docs.github.com/articles/creating-project-pages-manually).

## How to use the app

1. Choose a training group and figure family. These are review labels, not a verified competition entry list.
2. Set a checkpoint label, such as `Peak extension`.
3. Confirm permission before selecting the video. Obtain parent permission where appropriate. An H.264 MP4 is recommended; file limit is 200 MB.
4. Play/scrub to a useful above-water checkpoint, then click **Capture current frame**.
5. Optionally click **Suggest landmarks with AI**. First loading can take time. The model attempts to choose the leg with higher landmark visibility, which is not necessarily the raised leg.
6. Mark two points along the level water surface near the swimmer. Mark hip (only if genuinely visible), knee, ankle, and optionally toe on the same intended leg. Click on the image or use X/Y percentage fields and Set point.
7. To correct one point, select it in Mark point and reposition it. To remove a hidden AI landmark, use Reset points and re-mark visible points manually. Never guess a submerged hip.
8. Confirm you verified the points and select **Analyze & save key frame**.
9. For sampled stability, save at least three distinct frames spanning 0.5–3 seconds of the same held checkpoint. Keep the same group, figure, phase label, leg, and fixed camera.
10. Review measurements, recommendations, and reference links. Download JSON before clearing/reloading if you want to retain the numeric review.

The JSON contains times, pixel coordinates, image dimensions, labels, and measurements. It does not contain video or key-frame images. There is no import function or persistent session history.

## What is implemented

| Feature | Current behavior |
|---|---|
| Training groups | Novice, Intermediate, 12 & Under, Youth, Junior / Senior, Masters |
| Figure families | Ballet leg, Vertical position, Barracuda checkpoint, Flamingo extended leg, Fishtail extended leg, Other |
| Video input | Local browser file selection and playback; not server upload |
| Key frames | User-selected, manually captured |
| AI assistance | Optional MediaPipe landmark suggestions on a captured image |
| Measurements | Human-verified 2D geometry; formula details below |
| Recommendations | Deterministic text and provisional thresholds, not an LLM |
| References | Curated external demonstrations and official resource pages |
| Export | JSON of saved numeric observations |

## How AI and analysis work

1. The browser decodes the video and draws the chosen frame to Canvas.
2. Optional MediaPipe Pose Landmarker estimates body points locally on the device. The app requests one pose, uses detection/presence thresholds of 0.5, and accepts individual landmark suggestions with reported visibility at least 0.7 and in-frame coordinates.
3. The user verifies or corrects landmarks and establishes the waterline.
4. JavaScript calculates geometry. A small rule-based recommendation engine explains the observations.

No model is trained here. There is no automatic movement-phase recognition, continuous pose tracking, LLM/API call, or validated confidence score. Reported landmark visibility is a model signal, not a guarantee that a point is actually visible.

### Measurement definitions

Let W1 and W2 be waterline points; H, K, and A be hip, knee, and ankle. Let n be the unit normal to the waterline oriented upward in the image, and s = distance(K,A).

| Measurement | Formula/meaning | Limitation |
|---|---|---|
| Shin tilt | acos(abs(dot(A−K,n))/s), in degrees | Unsigned 0–90° deviation; ignores orientation and is not full-body tilt |
| Knee extension | Angle between H−K and A−K | Requires a genuinely visible hip; projected 180° means straight in this view |
| Relative height | dot(A−W1,n)/s | Ankle clearance in shin-length units, not cm, percent body height, or an official height grade |
| Sampled tilt range | Maximum minus minimum saved shin tilt | Requires ≥3 matching frames over 0.5–3 s; not continuous or whole-body stability |

Waterline points must be at least 20 processed-image pixels apart; shin points at least 15. The image is resized to a maximum width of 1280 pixels. Stability groups all saved frames matching the latest group, figure and phase; remove unrelated frames or use distinct phase labels for different holds.

Review triggers: shin tilt >5° and knee extension <170°. These are **unvalidated prototype heuristics**, not official standards or deductions. Relative height is described but not graded. Toe placement is drawn but toe-point quality is not automatically evaluated. A longer hold is not assumed to be better.

## Privacy and safety

- Videos and frames remain in browser memory during the session. No persistence, analytics, or video submission endpoint is implemented.
- Clearing/reloading removes the in-app record. Downloaded JSON remains wherever you saved it.
- The app loads code/WASM from jsDelivr, model assets from Google storage, and fonts from Google Fonts. These providers receive ordinary network requests; this is not an offline app.
- External videos open on YouTube; applicable provider privacy policies apply.
- Never commit athlete data to a public repository. `.gitignore` helps with CLI uploads but is not a security boundary or a substitute for reviewing browser uploads.
- Above-water footage cannot establish underwater body alignment, sculling quality, or strength. Perspective, camera movement, refraction, occlusion, and incorrect landmarks can invalidate results.
- This is not medical, safety-monitoring, judging, or coaching certification software. Discuss suggestions with a qualified coach. Never practice breath-hold or underwater drills alone.

## Files and development

| File | Purpose |
|---|---|
| `index.html` | Interface, selectors, labels, and resource links |
| `style.css` | Responsive layout and visual theme |
| `app.js` | Video capture, optional AI loading, geometry, recommendations, export |
| `tests/geometry.cjs` | Small formula regression test using the app's calculation function |
| `.gitignore` | Excludes common private data, credentials, and local artifacts |
| `.nojekyll` | Signals static-file publishing on GitHub Pages |

Edit dropdowns and resource cards in `index.html`. Edit geometry in `calculate()` and recommendation conditions in `render()` in `app.js`. This release retains the original MVP's compact source formatting; there is no bundler or dependency installation.

Optional developer checks (Node.js installed):

```bash
node --check app.js
node tests/geometry.cjs
```

Syntax and synthetic geometry tests were run for this package. They do not validate the AI model or browser workflow on real swimmer videos. The hosted app was not changed by this export.

### Manual acceptance checklist

- Load a consented MP4; capture a frame and manually mark a known straight leg.
- Try AI suggestions; verify correct handling of missing landmarks and network failure.
- Correct AI points; confirm verification resets.
- Save three matched frames; check tilt range against a manual calculation.
- Delete a frame; confirm results update.
- Export JSON and confirm no video/image payload is included.
- Clear the video; confirm records disappear.
- Test desktop and phone browser layouts, keyboard coordinate input, and unsupported codecs.

### Troubleshooting

| Problem | Action |
|---|---|
| Video will not play | Export an H.264 MP4; MOV/HEVC support varies by browser |
| AI fails to load | Check internet and external-domain policies; manual marking still works |
| Wrong or hidden AI points | Reset and mark visible points; AI may fail on inverted/submerged poses |
| Extension says Not visible | Hip is absent or too close to knee; do not guess it |
| Stability unavailable | Check number of frames, matching labels, and 0.5–3 second time span |
| Pages returns 404 | Check `index.html` at root and selected branch/folder; inspect GitHub deployment status |
| Mobile slows down | Use a shorter/lower-resolution clip; reduce saved frames |

## Roadmap

1. Validate on permissioned videos with a coach/judge and quantify point/angle error.
2. Verify rule versions and map competition groups to actual eligible figures.
3. Improve inverted-pose detection and allow explicit leg selection/point removal.
4. Add automated candidate key frames and robust continuous tracking.
5. Replace provisional thresholds with documented, independently validated practice benchmarks.
6. Add coach-approved, figure-specific drills and evaluation of recommendation usefulness.

## References and attribution

- [Google MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js). Runtime loads `@mediapipe/tasks-vision@0.10.22` and the Pose Landmarker Lite float16 model; code/model assets are not bundled in the ZIP.
- [USA Artistic Swimming figure review sheets](https://www.usaartisticswim.org/resources/judges/figure-review-sheets).
- [World Aquatics rules/manuals](https://www.worldaquatics.com/artistic-swimming/rules). The prototype references 2022–2025 BP 3 and BP 6; current competition rules are not verified. The manual is not redistributed here.
- [Swim England ballet-leg demonstration](https://www.youtube.com/watch?v=zht0xulr7Zc) and [straight ballet-leg demonstration](https://www.youtube.com/watch?v=HicVHvZuFMk). These are external references, not individualized exercise prescriptions or USAAS scoring authority.
- [Edriss et al., 2024: computer vision in artistic swimming](https://reference-global.com/article/10.2478/ijcss-2024-0010). Prior related work; this app has not reproduced or inherited the study's validation.

Initial implementation was generated with AI assistance in collaboration with the project owner. For student competitions, disclose assistance according to the rules and maintain an honest log of Xavier's own design, coding, testing and learning. Do not claim this initial generated code was entirely independently student-written.

## License decision

No open-source license has been selected for this export. Choose one intentionally before granting reuse rights; a public GitHub repository is not by itself an open-source license. External libraries, model assets, fonts, videos, and manuals retain their own terms. Do not imply endorsement by World Aquatics, USAAS, or Swim England.
