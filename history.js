// history.js
// Keeps past reviews in this browser (localStorage), so a swimmer can see progress.
// Only numbers and text are kept, never the video or frames.
// It stays on this device and this browser only. Clearing site data removes it.

const KEY = 'figuresense-history-v1';

export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];   // private window or storage blocked: just start empty
  }
}

function store(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Turn the current results into a small record worth keeping.
export function makeReview(figure, out, swimmer) {
  const scores = {};
  for (const r of out.results) scores[r.checkpoint.id] = r.saved ? +r.score.toFixed(1) : null;
  return {
    id: Date.now().toString(36),
    date: new Date().toISOString(),
    swimmer: swimmer.trim(),
    figure: figure.number,
    figureScore: +out.figureScore.toFixed(2),
    provisional: out.provisional,
    scores,
    top: out.issues.slice(0, 3).map(i => `${i.title} (${i.checkpoint.label})`),
  };
}

// Add a new review, or replace the one with the same id. Returns false if it couldn't be saved.
export function saveReview(review) {
  const list = loadHistory().filter(r => r.id !== review.id);
  list.push(review);
  return store(list);
}

export function deleteReview(id) {
  return store(loadHistory().filter(r => r.id !== id));
}

export function clearHistory() {
  return store([]);
}

// The review just before this one for the same swimmer and figure, if any.
export function previousFor(list, review) {
  const name = review.swimmer.toLowerCase();
  return list
    .filter(r => r.figure === review.figure && r.swimmer.toLowerCase() === name && r.date < review.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}
