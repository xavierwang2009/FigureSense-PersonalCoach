# FigureSense 

A plain, one-page Ballet Leg (figure 101) checker. Load a practice video, mark five
checkpoints, and get measured angles, a practice score and drills. Everything runs in
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

## Development record
See [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) for the reported local starting point,
the GitHub import, and subsequent changes and test observations.
