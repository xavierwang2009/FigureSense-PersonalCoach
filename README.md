# FigureSense — Artistic Swimming Practice Advisor

[Open the app](https://xavierwang2009.github.io/FigureSense-PersonalCoach) — no installation needed.

FigureSense reviews a practice video of an artistic swimming figure in the browser. It suggests the figure's checkpoints for you to review, measures the body against the figure's requirements, shows what is good and where the deviations are, and turns the biggest shortfalls into drills to practise. The figure picker follows swimmer groups; Ballet Leg includes five-checkpoint review and automatic suggestions. It is a practice tool, not a validated AI judge or an official scoring system.

## Source and reproduction

This source matches the published app. Edit the JavaScript in `src/`, then rebuild the bundled HTML:

```sh
python3 scripts/build.py
python3 scripts/serve.py 8000
```

Open http://localhost:8000. Python is only used to build and serve the files; video analysis runs in the browser.

| File | Job |
|---|---|
| `index.html`, `FigureSense-Hero.html` | Matching entry pages with bundled application modules |
| `src/app.js` | Navigation, video review, editable landmarks, results and drills |
| `src/figures.js` | Swimmer groups, figure requirements and drills |
| `src/geometry.js` | Measurements and practice scoring |
| `src/poses.js` | Position illustrations |
| `src/autoscan.js`, `src/ballet-assist.js` | Pose detection and Ballet Leg checkpoint suggestions |
| `hero-assets/`, `demo-assets/`, `figuresense-icon.png` | Homepage styling, scripts and approved demo media |
| `scripts/build.py` | Rebuilds the entry pages from `src/` |
| `scripts/package_demo.py` | Regenerates the portable demo archive |
| `tests/` | Geometry, measurement and demo consistency checks |
| `app.js`, `style.css`, `docs/legacy-mvp.md` | Earlier MVP retained for its geometry test; not loaded by the current page |

Run the checks from this folder:

```sh
python3 scripts/build.py --check
node tests/geometry.cjs
node tests/measurements.cjs
node tests/current-demo.cjs
```

To rebuild the downloadable demo, run `python3 scripts/package_demo.py` after rebuilding the pages.

## Notes
- "Suggest body points" and "Find the moments for me" download MediaPipe Pose
  (Google, open source, Apache 2.0) from the internet the first time.
- Scores are practice estimates, not official judging.

## Screens
- **Figure:** pick the swimmer group (Novice, Intermediate, 12 & Under, Youth) and a figure from that group's sheet.
  Review capabilities vary by figure. The figure card has the description, the position sequence
  with each position's share of the score, and the technical requirements.
- **Video:** choose or drop a clip; a preview plays under the box.
- **Review:** a heading with the position picture, a checkpoint stepper with scores, a timeline with numbered marks,
  ±0.5 s / ±0.033 s buttons, keyboard shortcuts (←/→, Shift, Space, C), thumbnails of captured frames,
  "Inspect & fine-tune" (move the frame ±0.033 s and keep the dots), coloured point chips, Coach's eye and
  measurement cards with dials.
- **Results:** a scoreboard that counts up, a diagnostics card per checkpoint (your frame with target lines beside a
  required-vs-your-video table), and "What to work on": the focus position, the top problems with pool and land drills,
  each drill's video segment playing in the card, a "watch for" list for the coach, and a safety line.

## Look and feel

- **Home:** a recorded demo of Xavier's Ballet Leg with reviewed tracking. His clip plays with the skeleton overlaid, locks onto each checkpoint with the measured angle and verdict, and ends on the next focus. Drag the scrubber or use the arrow and Page Up/Down keys; the pause button stops the motion.
- **Themes:** deep marine dark and warm sand light. The system setting is followed until the switch in the top bar is used; the choice is remembered on that device.
- **Navigation:** the four review steps sit in a floating glass tab bar; a highlight glides to the tab you open.
- **Motion:** an animated logo, water ripples that trail the pointer, page transitions, position cards that flip and tilt in 3D, and a score that counts up when Results open. Decorative motion is disabled and the demo starts paused when the device asks for reduced motion.

## Privacy and safety

Videos and working frames stay in browser memory; refreshing clears the current review. Pose detection loads MediaPipe code and model files from jsDelivr and Google storage, the app loads Google Fonts, and a drill video loads from YouTube's privacy-enhanced player only when **Watch the drill** is pressed. No video is sent to an analysis service.

The project owner expressly approved publishing the included Xavier portrait, the selected Ballet Leg demo clip and the downloadable archive. This approval does not extend to other athletes or uploads. Do not commit consent records, private review exports, credentials, or additional athlete media without authorization.

## References and attribution

The Ballet Leg guidance uses the World Aquatics figure manual (February 2026), BP 1, BP 3 and BM 1–2. The manuals are not redistributed here. Verify requirements for the applicable competition.

- [World Aquatics rules and manuals](https://www.worldaquatics.com/artistic-swimming/rules)
- [USA Artistic Swimming figure review sheets](https://www.usaartisticswim.org/resources/judges/figure-review-sheets)
- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- Ballet Leg drill videos, each played from the start to the end of its drill: Swim England [Ballet leg, Figure 101](https://www.youtube.com/watch?v=zht0xulr7Zc) and [Alternating ballet legs while travelling head first](https://www.youtube.com/watch?v=JdfNGxCfDwU); Natsumi Coaching [Training for Ballet leg](https://www.youtube.com/watch?v=5iBki3t56fU), [Wall ballet leg](https://www.youtube.com/watch?v=_fS01-_mLvI), [Layback Sculling for Ballet Legs](https://www.youtube.com/watch?v=CzYpbjrOTrc) and [How to Improve Your Pointed Toes](https://www.youtube.com/watch?v=-xOs_6QC9g8); The Online Synchro Coach [Ballet Leg Drill](https://www.youtube.com/watch?v=0GZ-f-7S65E) and [Layout, sailboat and ballet leg drill](https://www.youtube.com/watch?v=Flk-_pupvu0); Aquatica Synchro Club [Practicing Back Layout Position on Land](https://www.youtube.com/watch?v=I3KkBPRtVFI).

## Development record
See [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) for the reported local starting point,
the GitHub import, and subsequent changes and test observations.
