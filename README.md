# FigureSense 

A browser-based practice review app for Ballet Leg, Barracuda and Kip. Choose a
figure, load a practice video, review its checkpoints, and get measured angles,
a practice score and drills. Everything runs in
the browser; videos are never uploaded.

## Files
| File | Job |
|---|---|
| `index.html` | The page and its styling |
| `figures.js` | Figure data (Ballet Leg, Barracuda, Kip): checkpoints, requirements, coach's-eye items, drills |
| `geometry.js` | Angles against the waterline, deductions, checkpoint and figure scores |
| `poses.js` | Small still drawings of each position |
| `autoscan.js` | MediaPipe pose detection and scanning the video |
| `ballet-assist.js` | Picks the five moments and turns a pose into suggested points |
| `figure-assist.js` | Finds the checkpoint moments automatically for Barracuda and Kip (Ballet Leg uses `ballet-assist.js`) |
| `nav.js` | Step-by-step screens (Home, Figure, Video, Review, Results, Progress), tab highlight, Illustration/Diagram switch |
| `theme.css` | The FigureSense prototype's stylesheet, copied unchanged for the same look; app-specific styles stay in `index.html` |
| `hero-assets/`, `art/`, `demo-assets/`, `figuresense-icon.png` | The prototype's home page, theme switch and intro, position illustrations, Xavier's demo clip and icon |
| `app.js` | Connects the page: video, capture, marking, saving, results |

## Put it online (GitHub Pages, free)
1. Create a new public repository on GitHub and upload all the files in this folder.
2. Settings → Pages → Deploy from a branch → `main`, folder `/ (root)` → Save.
3. After a minute or two the app is at `https://<your-username>.github.io/<repository-name>/`.

## Try it on your own computer
In this folder run `python3 -m http.server 8000` and open http://localhost:8000.
(Opening index.html directly from Finder won't work, because browsers block modules from files.)

## Notes
- "Suggest body points" and "Find the five moments for me" download MediaPipe Pose
  (Google, open source, Apache 2.0) from the internet the first time.
- Scores are practice estimates, not official judging.

## Screens (matching the FigureSense prototype's look)
- **Figure:** pick the swimmer group (Novice, Intermediate, 12 & Under, Youth) and a figure from that group's sheet.
  Figures the app can't review yet are greyed out. The figure card has the description, the position sequence
  with each position's share of the score, and the technical requirements.
- **Video:** choose or drop a clip; a preview plays under the box.
- **Review:** a heading with the position picture, a checkpoint stepper with scores, a timeline with numbered marks,
  ±0.5 s / ±1 frame buttons, keyboard shortcuts (←/→, Shift, Space, C), thumbnails of captured frames,
  "Inspect & fine-tune" (move the frame ±1 frame and keep the dots), coloured point chips, Coach's eye and
  measurement cards with dials.
- **Results:** a scoreboard that counts up, a diagnostics card per checkpoint (your frame with target lines beside a
  required-vs-your-video table), and "What to work on": the focus position, the top problems with pool and land drills,
  each drill's video segment playing in the card, a "watch for" list for the coach, and a safety line.
- **Progress:** saved reviews on this device (unchanged).

## Development record
See [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) for the reported local starting point,
the GitHub import, and subsequent changes and test observations.

## Running it
From this folder run `python3 -m http.server`, then open http://localhost:8000. Opening `index.html` straight from disk does not work, because the browser blocks the modules.
