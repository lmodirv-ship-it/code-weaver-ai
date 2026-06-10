// Tiny browser-side "learning" language model — answers, makes mistakes, learns.
// Persistence: localStorage. No server needed.

export type Interaction = {
  q: string;
  a: string;            // model's answer
  correct?: string;     // user-provided correct answer
  feedback: 1 | -1 | 0; // 👍 / 👎 / none
  ts: number;
};

export type ModelState = {
  temperature: number;       // exploration vs exploitation
  vocab: Record<string, number>; // word -> weight
  pairs: { q: string; a: string; score: number }[]; // learned Q→A pairs
  history: Interaction[];
};

const KEY = "ai-lab-model-v1";

const DEFAULT_STATE: ModelState = {
  temperature: 0.8,
  vocab: {},
  pairs: [
    { q: "مرحبا", a: "أهلاً بك! كيف أساعدك؟", score: 1 },
    { q: "hello", a: "Hi there! How can I help?", score: 1 },
    { q: "من أنت", a: "أنا نموذج صغير يتعلم من تفاعلاتك.", score: 1 },
    { q: "who are you", a: "I'm a tiny model that learns from you.", score: 1 },
  ],
  history: [],
};

const FALLBACKS_AR = ["لست متأكداً 🤔", "ربما...", "لا أعرف بعد، علّمني!", "هممم...", "أحتاج مساعدتك في هذا"];
const FALLBACKS_EN = ["Not sure 🤔", "Maybe...", "I don't know yet, teach me!", "Hmm...", "I need your help here"];
const NOISE_AR = ["؟؟؟", "خطأ!", "ههه", "..."];
const NOISE_EN = ["???", "oops!", "hehe", "..."];

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

function isArabic(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

function similarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.sqrt(ta.size * tb.size);
}

export function loadState(): ModelState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE, pairs: [...DEFAULT_STATE.pairs] };
    const s = JSON.parse(raw) as ModelState;
    if (!s.pairs?.length) s.pairs = [...DEFAULT_STATE.pairs];
    return s;
  } catch {
    return { ...DEFAULT_STATE, pairs: [...DEFAULT_STATE.pairs] };
  }
}

export function saveState(s: ModelState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function resetState(): ModelState {
  const s = { ...DEFAULT_STATE, pairs: [...DEFAULT_STATE.pairs], history: [] };
  saveState(s);
  return s;
}

// Probabilistic answer: searches learned pairs, applies temperature-based noise.
export function answer(state: ModelState, question: string): string {
  const ar = isArabic(question);
  const candidates = state.pairs
    .map((p) => ({ ...p, sim: similarity(p.q, question) }))
    .filter((c) => c.sim > 0)
    .sort((a, b) => b.sim * b.score - a.sim * a.score);

  // Inject "mistake" probability based on temperature.
  const mistakeChance = Math.min(0.6, state.temperature * 0.4);
  if (Math.random() < mistakeChance || candidates.length === 0) {
    const pool = ar ? FALLBACKS_AR : FALLBACKS_EN;
    // High temperature → more chaos
    if (state.temperature > 0.7 && Math.random() < 0.4) {
      const noise = ar ? NOISE_AR : NOISE_EN;
      return noise[Math.floor(Math.random() * noise.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Softmax-ish sampling over top candidates by temperature.
  const top = candidates.slice(0, 5);
  const weights = top.map((c) => Math.pow(c.sim * c.score, 1 / Math.max(0.1, state.temperature)));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i].a;
  }
  return top[0].a;
}

// Learn from explicit correction.
export function teach(state: ModelState, q: string, correct: string): ModelState {
  const existing = state.pairs.find((p) => p.q.toLowerCase() === q.toLowerCase());
  if (existing) {
    existing.a = correct;
    existing.score = Math.min(5, existing.score + 1);
  } else {
    state.pairs.push({ q, a: correct, score: 1 });
  }
  return state;
}

// Apply 👍 / 👎 to the last answer in history.
export function applyFeedback(state: ModelState, idx: number, fb: 1 | -1): ModelState {
  const inter = state.history[idx];
  if (!inter) return state;
  inter.feedback = fb;
  const pair = state.pairs.find((p) => p.a === inter.a);
  if (pair) pair.score = Math.max(0.1, pair.score + (fb === 1 ? 0.5 : -0.7));
  // Cool down temperature after positive feedback, heat up after negative.
  if (fb === 1) state.temperature = Math.max(0.2, state.temperature * 0.97);
  else state.temperature = Math.min(1.2, state.temperature * 1.03);
  return state;
}

export function record(state: ModelState, q: string, a: string): ModelState {
  state.history.push({ q, a, feedback: 0, ts: Date.now() });
  if (state.history.length > 500) state.history.shift();
  return state;
}
