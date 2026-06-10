import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  loadState,
  saveState,
  resetState,
  answer,
  teach,
  applyFeedback,
  record,
  clearHistory,
  detectLang,
  type ModelState,
} from "@/lib/learning-model";

export const Route = createFileRoute("/ai-lab")({
  head: () => ({
    meta: [
      { title: "مختبر الذكاء — يتعلم من تفاعلك | AI Lab" },
      {
        name: "description",
        content:
          "نموذج صغير يعمل في متصفحك: يُجيب، يُخطئ، ويتعلم من تصحيحاتك. عربي/إنجليزي.",
      },
    ],
  }),
  component: AiLab,
});

type Msg = { role: "user" | "model"; text: string; idx?: number };

function AiLab() {
  const [state, setState] = useState<ModelState>(() => loadState());
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [teachingFor, setTeachingFor] = useState<number | null>(null);
  const [correction, setCorrection] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    const a = answer(state, q);
    const next = { ...state };
    record(next, q, a);
    setState(next);
    const histIdx = next.history.length - 1;
    setMsgs((m) => [
      ...m,
      { role: "user", text: q },
      { role: "model", text: a, idx: histIdx },
    ]);
    setInput("");
  };

  const feedback = (idx: number, fb: 1 | -1) => {
    setState((s) => applyFeedback({ ...s }, idx, fb));
    if (fb === -1) setTeachingFor(idx);
  };

  const submitCorrection = () => {
    if (teachingFor == null || !correction.trim()) return;
    const inter = state.history[teachingFor];
    if (!inter) return;
    const next = teach({ ...state }, inter.q, correction.trim());
    setState(next);
    setMsgs((m) => [...m, { role: "model", text: `✅ تعلمت: "${inter.q}" → "${correction.trim()}"` }]);
    setCorrection("");
    setTeachingFor(null);
  };

  const reset = () => {
    if (!confirm("إعادة تعيين ذاكرة النموذج؟")) return;
    setState(resetState());
    setMsgs([]);
  };

  const stats = {
    pairs: state.pairs.length,
    interactions: state.history.length,
    likes: state.history.filter((h) => h.feedback === 1).length,
    dislikes: state.history.filter((h) => h.feedback === -1).length,
    temp: state.temperature.toFixed(2),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
              🧠
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">مختبر الذكاء</h1>
              <p className="text-xs text-slate-500">يُجيب · يُخطئ · يتعلم منك</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="text-sm px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              ← مولّد المواقع
            </Link>
            <button
              onClick={reset}
              className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
            >
              إعادة تعيين
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[1fr_280px] gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[70vh] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="rtl">
            {msgs.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-12">
                ابدأ بكتابة سؤال... النموذج سيُجيب، وأحياناً يُخطئ — صحّح له ليتعلم 💡
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <div>{m.text}</div>
                  {m.role === "model" && m.idx != null && state.history[m.idx]?.feedback === 0 && (
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => feedback(m.idx!, 1)}
                        className="text-xs px-2 py-0.5 rounded bg-white hover:bg-green-50 border border-slate-200"
                        title="إجابة صحيحة"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => feedback(m.idx!, -1)}
                        className="text-xs px-2 py-0.5 rounded bg-white hover:bg-red-50 border border-slate-200"
                        title="إجابة خاطئة — علّمني"
                      >
                        👎
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {teachingFor != null && (
            <div className="border-t border-amber-200 bg-amber-50 p-3" dir="rtl">
              <div className="text-xs text-amber-800 mb-2">
                ✏️ ما الإجابة الصحيحة لـ: «{state.history[teachingFor]?.q}»؟
              </div>
              <div className="flex gap-2">
                <input
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitCorrection()}
                  placeholder="اكتب الإجابة الصحيحة..."
                  className="flex-1 text-sm rounded-lg border border-amber-300 px-3 py-2"
                  autoFocus
                />
                <button
                  onClick={submitCorrection}
                  className="text-sm px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                >
                  علّم
                </button>
                <button
                  onClick={() => setTeachingFor(null)}
                  className="text-sm px-3 py-2 rounded-lg border border-slate-300 hover:bg-white"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 p-3 flex gap-2" dir="rtl">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="اكتب سؤالك..."
              className="flex-1 text-sm rounded-xl border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            />
            <button
              onClick={send}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-md hover:opacity-95"
            >
              إرسال
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">📊 حالة النموذج</h3>
            <dl className="text-xs space-y-2">
              <div className="flex justify-between"><dt className="text-slate-500">الأزواج المتعلَّمة</dt><dd className="font-semibold">{stats.pairs}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">التفاعلات</dt><dd className="font-semibold">{stats.interactions}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">👍 إعجاب</dt><dd className="font-semibold text-green-600">{stats.likes}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">👎 خاطئ</dt><dd className="font-semibold text-red-600">{stats.dislikes}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">الحرارة (T)</dt><dd className="font-semibold">{stats.temp}</dd></div>
            </dl>
            <div className="mt-3">
              <label className="text-xs text-slate-500">درجة الاستكشاف</label>
              <input
                type="range"
                min={0.1}
                max={1.2}
                step={0.05}
                value={state.temperature}
                onChange={(e) =>
                  setState((s) => ({ ...s, temperature: parseFloat(e.target.value) }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>دقيق</span>
                <span>عشوائي</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">💡 كيف يعمل؟</h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pr-4" dir="rtl">
              <li>يبحث عن أفضل تطابق بين سؤالك والأزواج المحفوظة.</li>
              <li>يستخدم «الحرارة» لاختيار إجابة عشوائية أحياناً → أخطاء مفيدة.</li>
              <li>👎 يطلب منك التصحيح ويحفظه كذاكرة دائمة.</li>
              <li>👍 يرفع وزن الإجابة ويخفض الحرارة تدريجياً.</li>
              <li>كل شيء يعمل محلياً في متصفحك (localStorage).</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
