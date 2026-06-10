import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;
import { useServerFn } from "@tanstack/react-start";
import { generateWebsite, type TemplateName } from "@/lib/website-generator";
import {
  listProjects,
  saveProject,
  deleteProject,
  type Project,
} from "@/lib/projects-store";
import { analyzeWebsite } from "@/lib/analyze.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مصمم المواقع الذكي | Smart Website Designer" },
      {
        name: "description",
        content:
          "صف موقعك بالعربية أو الإنجليزية واحصل على HTML جاهز فوراً مع معاينة مباشرة، قوالب متعددة، حفظ المشاريع وتصديرها كـ ZIP.",
      },
      { property: "og:title", content: "مصمم المواقع الذكي" },
      {
        property: "og:description",
        content: "ولّد مواقع جاهزة من وصف نصي مع معاينة فورية وتصدير ZIP.",
      },
    ],
  }),
  component: Index,
});

const EXAMPLES = [
  "موقع لمطعم عربي يحتوي على شريط علوي وقائمة طعام وصور ونموذج تواصل، باللون الأخضر",
  "Landing page for a SaaS product with hero, features cards, pricing table and contact form",
  "موقع شركة تقنية باللون الأزرق مع قائمة خدمات ومعرض صور وتذييل",
];

function Index() {
  const loadVoiceSettings = () => {
    try {
      const raw = localStorage.getItem("voiceSettings");
      if (raw) return JSON.parse(raw) as Record<string, unknown>;
    } catch { /* ignore */ }
    return null;
  };
  const storedVoice = loadVoiceSettings();

  const [mode, setMode] = useState<"create" | "describe">("create");
  const [lang, setLang] = useState<"ar" | "en">((storedVoice?.lang as "ar" | "en") ?? "ar");
  const [description, setDescription] = useState<string>(EXAMPLES[0]);
  const [template, setTemplate] = useState<TemplateName>("default");
  const [html, setHtml] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [tab, setTab] = useState<"preview" | "code" | "projects">("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Describe-existing-site state
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [analysis, setAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analyzeError, setAnalyzeError] = useState<string>("");
  const [analyzedSiteUrl, setAnalyzedSiteUrl] = useState<string>("");
  const [analyzedScreenshot, setAnalyzedScreenshot] = useState<string>("");
  const [detectedPages, setDetectedPages] = useState<string[]>([]);
  const runAnalyze = useServerFn(analyzeWebsite);

  // Batch analysis of a list of websites
  const [bulkUrls, setBulkUrls] = useState<string>("");
  const [bulkResults, setBulkResults] = useState<Array<{ url: string; description: string; pageCount: number; error?: string }>>([]);
  const [bulkRunning, setBulkRunning] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // Smart assistant (mascot + voice + log)
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [mascotActive, setMascotActive] = useState<boolean>(false);
  const [mascotPos, setMascotPos] = useState<{ top: string; left: string }>({ top: "75%", left: "10%" });
  const [mascotMessage, setMascotMessage] = useState<string>("");
  const [lastSpeech, setLastSpeech] = useState<string>("");
  const tourTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice controls
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>((storedVoice?.selectedVoiceURI as string) ?? "");
  const [speechRate, setSpeechRate] = useState<number>((storedVoice?.speechRate as number) ?? 0.95);
  const [speechPitch, setSpeechPitch] = useState<number>((storedVoice?.speechPitch as number) ?? 1);
  const [voiceLangFilter, setVoiceLangFilter] = useState<"all" | "ar" | "fr" | "en">((storedVoice?.voiceLangFilter as "all" | "ar" | "fr" | "en") ?? "all");

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        setVoices(v);
        setSelectedVoiceURI((prev) => {
          if (prev && v.some((x) => x.voiceURI === prev)) return prev;
          const arOne = v.find((x) => x.lang?.toLowerCase().startsWith("ar"));
          return (arOne || v[0]).voiceURI;
        });
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Persist voice settings
  useEffect(() => {
    const settings = { lang, selectedVoiceURI, speechRate, speechPitch, voiceLangFilter };
    localStorage.setItem("voiceSettings", JSON.stringify(settings));
  }, [lang, selectedVoiceURI, speechRate, speechPitch, voiceLangFilter]);

  const addLog = (msg: string) => {
    setLogEntries((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 20));
  };

  // Sound effects via Web Audio API (no external files)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = () => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  };
  const tone = (
    ctx: AudioContext,
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType = "sine",
    gain = 0.2,
  ) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    g.gain.setValueAtTime(0, ctx.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.02);
  };
  const noise = (ctx: AudioContext, start: number, dur: number, gain = 0.15) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(g).connect(ctx.destination);
    src.start(ctx.currentTime + start);
  };
  const playSfx = (id: string) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    switch (id) {
      case "click":
        tone(ctx, 1200, 0, 0.05, "square", 0.15);
        break;
      case "ding":
        tone(ctx, 880, 0, 0.4, "sine", 0.25);
        tone(ctx, 1320, 0.05, 0.4, "sine", 0.15);
        break;
      case "success":
        tone(ctx, 523, 0, 0.15, "triangle", 0.25);
        tone(ctx, 659, 0.12, 0.15, "triangle", 0.25);
        tone(ctx, 784, 0.24, 0.3, "triangle", 0.25);
        break;
      case "error":
        tone(ctx, 220, 0, 0.2, "sawtooth", 0.25);
        tone(ctx, 180, 0.18, 0.3, "sawtooth", 0.25);
        break;
      case "notify":
        tone(ctx, 988, 0, 0.12, "sine", 0.22);
        tone(ctx, 1318, 0.13, 0.2, "sine", 0.22);
        break;
      case "swoosh":
        noise(ctx, 0, 0.4, 0.18);
        break;
      case "applause":
        for (let i = 0; i < 12; i++) noise(ctx, i * 0.05, 0.18, 0.12);
        break;
      case "magic":
        for (let i = 0; i < 8; i++) tone(ctx, 600 + i * 180, i * 0.06, 0.2, "triangle", 0.15);
        break;
    }
  };

  const speak = (text: string) => {
    if (!text) return;
    setLastSpeech(text);
    setMascotMessage(text);
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voices.find((x) => x.voiceURI === selectedVoiceURI);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = lang === "ar" ? "ar-SA" : "en-US";
      }
      u.rate = speechRate;
      u.pitch = speechPitch;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  };

  const stopTour = () => {
    if (tourTimerRef.current) {
      clearInterval(tourTimerRef.current);
      tourTimerRef.current = null;
    }
    setMascotActive(false);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  };

  const startMascotTour = () => {
    stopTour();
    const sections = lang === "ar"
      ? [
          { name: "الشريط العلوي", desc: "يحتوي على الشعار وقائمة التنقل، تصميمه واضح وثابت.", pos: { top: "8%", left: "50%" } },
          { name: "قسم البطل", desc: "عنوان جذاب وصورة بارزة توجّه المستخدم للإجراء التالي.", pos: { top: "30%", left: "50%" } },
          { name: "زر الدعوة للإجراء", desc: "يبرز بلون متضاد لزيادة التحويلات.", pos: { top: "45%", left: "78%" } },
          { name: "لوحة الألوان", desc: "ألوان داكنة مع لمسات لامعة تناسب الهوية.", pos: { top: "65%", left: "18%" } },
          { name: "نقاط التحسين", desc: "يُنصح بتحسين السرعة وإضافة آراء العملاء.", pos: { top: "82%", left: "70%" } },
        ]
      : [
          { name: "Header", desc: "Logo and nav, clean and consistent layout.", pos: { top: "8%", left: "50%" } },
          { name: "Hero", desc: "Strong headline with visual to guide the user.", pos: { top: "30%", left: "50%" } },
          { name: "CTA Button", desc: "Contrasting color maximizes conversions.", pos: { top: "45%", left: "78%" } },
          { name: "Color palette", desc: "Dark theme with accent highlights matches the brand.", pos: { top: "65%", left: "18%" } },
          { name: "Improvements", desc: "Improve load speed and add customer reviews.", pos: { top: "82%", left: "70%" } },
        ];
    setMascotActive(true);
    let step = 0;
    const tick = () => {
      if (step >= sections.length) {
        stopTour();
        addLog(lang === "ar" ? "🏁 اكتمل التحليل التفاعلي" : "🏁 Interactive tour complete");
        speak(lang === "ar" ? "انتهيت من شرح الأقسام." : "Done explaining the sections.");
        setMascotPos({ top: "85%", left: "85%" });
        return;
      }
      const s = sections[step];
      setMascotPos(s.pos);
      addLog(`🔍 ${s.name} — ${s.desc}`);
      speak(`${s.name}. ${s.desc}`);
      step++;
    };
    tick();
    tourTimerRef.current = setInterval(tick, 4500);
  };

  useEffect(() => {
    return () => stopTour();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TV screen recording (getDisplayMedia + cropped Canvas + MediaRecorder) ──
  const tvScreenRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>("");
  const [recordedVideoMime, setRecordedVideoMime] = useState<string>("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingCleanupRef = useRef<(() => void) | null>(null);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const recordingProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickRecorderMime = () => {
    const candidates = [
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    for (const t of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  };

  const startRecording = async () => {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert(lang === "ar" ? "متصفحك لا يدعم تسجيل الشاشة" : "Your browser doesn't support screen capture");
      return;
    }
    const tvEl = tvScreenRef.current;
    if (!tvEl) return;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as MediaTrackConstraints,
        audio: false,
      });

      const videoEl = document.createElement("video");
      videoEl.muted = true;
      (videoEl as HTMLVideoElement).playsInline = true;
      videoEl.srcObject = displayStream;
      await new Promise<void>((resolve) => {
        videoEl.onloadedmetadata = () => resolve();
      });
      await videoEl.play();

      const rect = tvEl.getBoundingClientRect();
      const scaleX = videoEl.videoWidth / window.innerWidth;
      const scaleY = videoEl.videoHeight / window.innerHeight;

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(rect.width * (window.devicePixelRatio || 1)));
      canvas.height = Math.max(2, Math.round(rect.height * (window.devicePixelRatio || 1)));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D not available");

      let stopped = false;
      const draw = () => {
        if (stopped) return;
        try {
          ctx.drawImage(
            videoEl,
            rect.left * scaleX,
            rect.top * scaleY,
            rect.width * scaleX,
            rect.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        } catch {
          /* drawing before frame is ready */
        }
        requestAnimationFrame(draw);
      };
      draw();

      const canvasStream = (canvas as HTMLCanvasElement).captureStream(30);
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(recordedChunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl((prev) => {
          if (prev) {
            try { URL.revokeObjectURL(prev); } catch { /* ignore */ }
          }
          return url;
        });
        setRecordedVideoMime(finalMime);
        addLog(lang === "ar" ? "💾 جاهز للمعاينة والتحميل" : "💾 Ready to preview and download");
      };

      recordingCleanupRef.current = () => {
        stopped = true;
        try { displayStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
        try { canvasStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
        videoEl.srcObject = null;
        videoEl.remove();
      };

      displayStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopRecording();
      });

      recorder.start(1000);
      setIsRecording(true);
      setRecordingProgress(1);
      recordingProgressTimerRef.current = setInterval(() => {
        setRecordingProgress((prev) => {
          if (prev >= 99) return prev;
          return Math.min(99, prev + 0.25);
        });
      }, 100);
      addLog(lang === "ar" ? "🎥 بدأ تسجيل شاشة التلفاز" : "🎥 TV recording started");
    } catch (err) {
      console.error(err);
      addLog(`❌ ${(err as Error).message}`);
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* ignore */ }
    }
    if (recordingCleanupRef.current) {
      recordingCleanupRef.current();
      recordingCleanupRef.current = null;
    }
    if (recordingProgressTimerRef.current) {
      clearInterval(recordingProgressTimerRef.current);
      recordingProgressTimerRef.current = null;
    }
    setRecordingProgress(100);
    setIsRecording(false);
  };



  useEffect(() => {
    setProjects(listProjects());
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = () => {
    const code = generateWebsite(description, template);
    setHtml(code);
  };

  const onPickImage = (file: File | null) => {
    if (!file) {
      setImageDataUrl("");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAnalyzeError(lang === "ar" ? "الصورة كبيرة جداً (الحد 5MB)" : "Image too large (max 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    setAnalyzeError("");
    setAnalysis("");
    if (!siteUrl.trim() && !imageDataUrl) {
      setAnalyzeError(lang === "ar" ? "أدخل رابطاً أو ارفع صورة" : "Enter a URL or upload an image");
      return;
    }
    setAnalyzing(true);
    // Show the real site on the TV screen
    setAnalyzedSiteUrl(siteUrl.trim());
    setAnalyzedScreenshot(
      siteUrl.trim()
        ? `https://image.thum.io/get/width/1280/crop/900/noanimate/${siteUrl.trim()}`
        : imageDataUrl,
    );
    setTab("preview");
    addLog(lang === "ar" ? "🔍 بدء التحليل التفاعلي..." : "🔍 Starting interactive analysis...");
    startMascotTour();
    try {
      const res = await runAnalyze({
        data: { url: siteUrl.trim(), imageDataUrl, lang },
      });
      setAnalysis(res.description || "");
      if (res.screenshotUrl) setAnalyzedScreenshot(res.screenshotUrl);
      setDetectedPages(res.pages || []);
      addLog(
        lang === "ar"
          ? `✅ وصل التقرير — عدد الصفحات: ${res.pageCount ?? 0}`
          : `✅ Report ready — pages: ${res.pageCount ?? 0}`,
      );
    } catch (e) {
      setAnalyzeError((e as Error).message || "Error");
      addLog(`❌ ${(e as Error).message || "Error"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBulkAnalyze = async () => {
    const urls = bulkUrls
      .split(/[\n,;\s]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
    if (urls.length === 0) {
      setAnalyzeError(lang === "ar" ? "أضف روابط صحيحة (تبدأ بـ http)" : "Add valid URLs (http/https)");
      return;
    }
    setAnalyzeError("");
    setBulkResults([]);
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: urls.length });
    addLog(lang === "ar" ? `🚀 تحليل دفعة من ${urls.length} موقع` : `🚀 Analyzing ${urls.length} sites`);
    const results: Array<{ url: string; description: string; pageCount: number; error?: string }> = [];
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      setAnalyzedSiteUrl(u);
      setAnalyzedScreenshot(`https://image.thum.io/get/width/1280/crop/900/noanimate/${u}`);
      addLog(`🔎 ${i + 1}/${urls.length} — ${u}`);
      try {
        const res = await runAnalyze({ data: { url: u, imageDataUrl: "", lang } });
        results.push({ url: u, description: res.description || "", pageCount: res.pageCount ?? 0 });
      } catch (e) {
        results.push({ url: u, description: "", pageCount: 0, error: (e as Error).message });
      }
      setBulkResults([...results]);
      setBulkProgress({ done: i + 1, total: urls.length });
    }
    setBulkRunning(false);
    addLog(lang === "ar" ? "✅ انتهى تحليل القائمة" : "✅ Bulk analysis done");
  };

  const handleDownloadBulkReport = () => {
    if (bulkResults.length === 0) return;
    const lines: string[] = [];
    lines.push(lang === "ar" ? "# تقرير تحليل المواقع\n" : "# Websites Analysis Report\n");
    for (const r of bulkResults) {
      lines.push(`\n---\n\n## ${r.url}`);
      lines.push(`\n${lang === "ar" ? "عدد الصفحات" : "Pages"}: ${r.pageCount}\n`);
      if (r.error) lines.push(`\n**Error:** ${r.error}\n`);
      else lines.push(`\n${r.description}\n`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `websites_report_${Date.now()}.md`);
  };

  const downloadVideoToChosenLocation = async () => {
    if (!recordedVideoUrl) return;
    try {
      const r = await fetch(recordedVideoUrl);
      const blob = await r.blob();
      const ext = recordedVideoMime.includes("mp4") ? "mp4" : "webm";
      const suggestedName = `tv_recording_${Date.now()}.${ext}`;
      // Modern browsers / Electron with File System Access API: let user pick location
      const w = window as unknown as {
        showSaveFilePicker?: (opts: {
          suggestedName?: string;
          types?: Array<{ description: string; accept: Record<string, string[]> }>;
        }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
      };
      if (typeof w.showSaveFilePicker === "function") {
        try {
          const handle = await w.showSaveFilePicker({
            suggestedName,
            types: [{
              description: ext === "mp4" ? "MP4 Video" : "WebM Video",
              accept: { [`video/${ext}`]: [`.${ext}`] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          addLog(lang === "ar" ? "💾 تم حفظ الفيديو في المكان المختار" : "💾 Video saved to chosen location");
          return;
        } catch (err) {
          // User cancelled — bail without fallback
          if ((err as DOMException)?.name === "AbortError") return;
        }
      }
      // Fallback: regular download
      saveAs(blob, suggestedName);
    } catch (e) {
      addLog(`❌ ${(e as Error).message}`);
    }
  };



  const handleSave = () => {
    const name = projectName.trim() || description.slice(0, 40) || "مشروع";
    const p: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      template,
      html,
      createdAt: Date.now(),
    };
    saveProject(p);
    setProjects(listProjects());
    setProjectName("");
  };

  const handleLoad = (p: Project) => {
    setDescription(p.description);
    setTemplate(p.template as TemplateName);
    setHtml(p.html);
    setTab("preview");
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    setProjects(listProjects());
  };

  const handleExportZip = async (p?: Project) => {
    const target = p ?? {
      name: projectName.trim() || "website",
      html,
      description,
    };
    const zip = new JSZip();
    zip.file("index.html", target.html);
    zip.file("description.txt", target.description);
    zip.file(
      "README.md",
      `# ${target.name}\n\nGenerated by Smart Website Designer.\n\nOpen \`index.html\` in any browser.\n`,
    );
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${target.name.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, "_")}.zip`);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    saveAs(blob, "index.html");
  };

  const handleOpenInNewTab = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const previewSrc = useMemo(() => {
    return "data:text/html;charset=utf-8," + encodeURIComponent(html);
  }, [html]);

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at 50% 0%, #1a1a1a 0%, #0a0a0a 40%, #000000 100%)" }}>
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30">
              W
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white">
                مصمم المواقع الذكي
              </h1>
              <p className="text-xs text-zinc-300">
                Smart Website Designer · AR / EN
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/ai-lab"
              className="text-sm px-3 py-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white shadow-md hover:opacity-95"
            >
              🧠 مختبر الذكاء
            </Link>
            <button
              onClick={handleOpenInNewTab}
              disabled={!html}
              className="hidden sm:inline-flex text-sm px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-900/60 text-white hover:bg-zinc-800 disabled:opacity-60 disabled:text-zinc-400"
            >
              فتح في نافذة
            </button>
            <button
              onClick={handleDownloadHtml}
              disabled={!html}
              className="text-sm px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-900/60 text-white hover:bg-zinc-800 disabled:opacity-60 disabled:text-zinc-400"
            >
              HTML
            </button>
            <button
              onClick={() => handleExportZip()}
              disabled={!html}
              className="text-sm px-3 py-2 rounded-lg bg-white text-black font-semibold hover:bg-zinc-200 disabled:opacity-60 disabled:text-zinc-500"
            >
              تصدير ZIP
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row-reverse gap-6">
        {/* Description panel — right side on large screens */}
        <aside className="space-y-4 order-2 lg:order-1 w-full lg:w-1/3 lg:max-w-md">

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 shadow-sm">
            {/* Mode + Language toggles */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                <button
                  onClick={() => setMode("create")}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition ${
                    mode === "create" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  🎨 تصميم جديد
                </button>
                <button
                  onClick={() => setMode("describe")}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition ${
                    mode === "describe" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  🔍 وصف موقع موجود
                </button>
              </div>
              <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                <button
                  onClick={() => setLang("ar")}
                  className={`text-xs px-2 py-1 rounded ${lang === "ar" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400"}`}
                >
                  AR
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`text-xs px-2 py-1 rounded ${lang === "en" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400"}`}
                >
                  EN
                </button>
              </div>
            </div>

            {mode === "create" ? (
              <>
                <label className="block text-sm font-semibold text-zinc-100 mb-2">
                  {lang === "ar" ? "او اختيار وصف لموقع موجود" : "Describe your website"}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  className="w-full text-sm rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-900 outline-none resize-none placeholder:text-zinc-500"
                  placeholder={lang === "ar"
                    ? "مثال: موقع لمطعم باللون الأخضر مع شريط علوي ونموذج تواصل..."
                    : "Example: A SaaS landing page with hero, features and pricing..."}
                />

                <div className="flex flex-wrap gap-2 mt-2">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setDescription(ex)}
                      className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    >
                      {lang === "ar" ? "مثال" : "Example"} {i + 1}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">🎨 {lang === "ar" ? "القالب" : "Template"}</label>
                    <select
                      value={template}
                      onChange={(e) => setTemplate(e.target.value as TemplateName)}
                      className="w-full text-sm rounded-lg border border-zinc-700 px-3 py-2 bg-zinc-950 text-zinc-100"
                    >
                      <option value="default">Default (Modern)</option>
                      <option value="bootstrap">Bootstrap 5</option>
                      <option value="tailwind">Tailwind CDN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">💾 {lang === "ar" ? "اسم المشروع" : "Project name"}</label>
                    <input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="my-site"
                      className="w-full text-sm rounded-lg border border-zinc-700 px-3 py-2 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button
                    onClick={handleGenerate}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30 hover:opacity-95"
                  >
                    🚀 {lang === "ar" ? "توليد الموقع" : "Generate"}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!html}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30 hover:bg-amber-600 disabled:opacity-60 disabled:text-zinc-300"
                  >
                    💾 {lang === "ar" ? "حفظ" : "Save"}
                  </button>
                  <button
                    onClick={handleDownloadHtml}
                    disabled={!html}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-500 disabled:opacity-60 disabled:text-zinc-300"
                  >
                    ⬇️ {lang === "ar" ? "تحميل" : "Download"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold text-zinc-100 mb-2">
                  🔍 {lang === "ar" ? "حلّل موقعاً موجوداً" : "Analyze an existing site"}
                </label>

                <input
                  type="url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="w-full text-sm rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 px-3 py-2 focus:border-blue-500 outline-none placeholder:text-zinc-500"
                />

                <div className="mt-3">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    🖼️ {lang === "ar" ? "أو ارفع صورة لواجهة الموقع" : "Or upload a UI screenshot"}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-100 hover:file:bg-zinc-700"
                  />
                  {imageDataUrl && (
                    <img src={imageDataUrl} alt="upload" className="mt-2 max-h-32 rounded-md border border-zinc-800" />
                  )}
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full mt-4 text-sm font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-600 text-white shadow-md hover:opacity-95 disabled:opacity-60"
                >
                  {analyzing
                    ? (lang === "ar" ? "⏳ جاري التحليل..." : "⏳ Analyzing...")
                    : (lang === "ar" ? "🧠 تحليل ووصف الموقع" : "🧠 Analyze & describe")}
                </button>

                {analyzeError && (
                  <p className="mt-2 text-xs text-red-400">{analyzeError}</p>
                )}

                {detectedPages.length > 0 && (
                  <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-emerald-300">
                      📄 {lang === "ar" ? "عدد الصفحات المكتشفة" : "Pages detected"}: {detectedPages.length}
                    </p>
                    <ul dir="ltr" className="mt-1 max-h-32 overflow-auto text-[11px] text-zinc-300 font-mono space-y-0.5">
                      {detectedPages.slice(0, 50).map((p) => (
                        <li key={p} className="truncate">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis && (
                  <div
                    dir={lang === "ar" ? "rtl" : "ltr"}
                    className="mt-3 max-h-80 overflow-auto text-xs leading-relaxed bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-200 whitespace-pre-wrap"
                  >
                    {analysis}
                  </div>
                )}

                {/* Bulk URL list analysis */}
                <div className="mt-5 pt-4 border-t border-zinc-800">
                  <label className="block text-sm font-semibold text-zinc-100 mb-2">
                    📋 {lang === "ar" ? "أو حلّل قائمة مواقع دفعة واحدة" : "Or analyze a list of websites"}
                  </label>
                  <textarea
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    placeholder={"https://site1.com\nhttps://site2.com\nhttps://site3.com"}
                    dir="ltr"
                    rows={4}
                    className="w-full text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 px-3 py-2 focus:border-blue-500 outline-none placeholder:text-zinc-500 font-mono"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleBulkAnalyze}
                      disabled={bulkRunning}
                      className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white hover:opacity-95 disabled:opacity-60"
                    >
                      {bulkRunning
                        ? `⏳ ${bulkProgress.done}/${bulkProgress.total}`
                        : (lang === "ar" ? "🚀 تحليل القائمة" : "🚀 Analyze list")}
                    </button>
                    {bulkResults.length > 0 && (
                      <button
                        onClick={handleDownloadBulkReport}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                      >
                        ⬇️ {lang === "ar" ? "تحميل التقرير" : "Download report"}
                      </button>
                    )}
                  </div>

                  {bulkResults.length > 0 && (
                    <ul className="mt-3 space-y-2 max-h-72 overflow-auto">
                      {bulkResults.map((r, i) => (
                        <li key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg p-2">
                          <div dir="ltr" className="text-[11px] font-mono text-blue-300 truncate">{r.url}</div>
                          {r.error ? (
                            <p className="text-[11px] text-red-400 mt-1">{r.error}</p>
                          ) : (
                            <>
                              <p className="text-[11px] text-emerald-300 mt-0.5">
                                📄 {lang === "ar" ? "صفحات" : "Pages"}: {r.pageCount}
                              </p>
                              <p className="text-[11px] text-zinc-300 mt-1 line-clamp-3 whitespace-pre-wrap">
                                {r.description.slice(0, 240)}{r.description.length > 240 ? "…" : ""}
                              </p>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </>
            )}
          </div>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2">
              💼 المشاريع المحفوظة ({projects.length})
            </h3>
            {projects.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">
                لا توجد مشاريع بعد. ولّد موقعاً واضغط حفظ.
              </p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-auto -mx-1 px-1">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="border border-zinc-800 rounded-lg p-2.5 hover:bg-zinc-800 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleLoad(p)}
                        className="text-sm font-medium text-zinc-100 text-right truncate flex-1"
                      >
                        {p.name}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleExportZip(p)}
                          title="تصدير"
                          className="text-xs px-2 py-1 rounded hover:bg-zinc-700 text-zinc-300"
                        >
                          📦
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          title="حذف"
                          className="text-xs px-2 py-1 rounded hover:bg-red-900/30 text-red-400"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {p.template} · {new Date(p.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* TV — full width, above the description */}
        <section className="order-1 lg:order-2 flex flex-col w-full lg:flex-1 lg:min-w-0">


          {/* Outer box — deepest frame with rim light */}
          <div
            className="relative rounded-2xl p-1 border border-black shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95),inset_0_2px_0_rgba(255,255,255,0.18),inset_0_-2px_0_rgba(0,0,0,0.92),inset_2.5px_0_0_rgba(255,255,255,0.12),inset_-2.5px_0_0_rgba(0,0,0,0.85)]"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, #181818 0%, #080808 50%, #020202 100%)",
            }}
          >
            {/* Subtle wavy highlight band along the top inner edge */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1 top-0 h-[4px] rounded-t-2xl opacity-80"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 20%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.28) 80%, transparent 100%)",
              }}
            />
            {/* Outer box corner bolts — metallic */}
            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-700 shadow-[0_0_3px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.5)]" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-700 shadow-[0_0_3px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.5)]" />
            <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-700 shadow-[0_0_3px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.5)]" />
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-700 shadow-[0_0_3px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.5)]" />

            {/* Middle box — brushed metal */}
            <div
              className="relative rounded-xl p-1 border border-zinc-900/80 shadow-[inset_0_2px_0_rgba(255,255,255,0.22),inset_0_-2px_0_rgba(0,0,0,0.95),inset_2px_0_0_rgba(255,255,255,0.1),inset_-2px_0_0_rgba(0,0,0,0.85),0_4px_10px_-4px_rgba(0,0,0,0.75)]"
              style={{
                background:
                  "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 55%, #121212 100%)",
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2 top-0 h-[2px] opacity-90"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.45) 30%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.45) 70%, transparent)",
                }}
              />
              {/* Inner box (TV body) — glossy bezel */}
              <div
                className="relative rounded-lg p-2 border border-zinc-800/70 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.95),inset_0_2px_0_rgba(255,255,255,0.24),inset_0_-2px_4px_rgba(0,0,0,0.98),inset_2px_0_0_rgba(255,255,255,0.1),inset_-2px_0_0_rgba(0,0,0,0.88)]"
                style={{
                  background:
                    "linear-gradient(180deg, #0c0c0c 0%, #000 45%, #040404 100%)",
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1.5 top-0 h-[2px] opacity-95"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.5) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.5) 75%, transparent)",
                  }}
                />
                {/* TV bezel top controls */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.6)]" />
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="w-2 h-2 rounded-full bg-green-600" />
                    <span className="ml-1.5 text-[10px] text-zinc-400 font-mono">LIVE · شاشة المعاينة</span>
                  </div>
                  <div className="flex gap-1 bg-zinc-950 rounded-md p-0.5">
                    {(["preview", "code"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`text-[11px] px-2 py-0.5 rounded font-medium transition ${
                          tab === t
                            ? "bg-zinc-200 text-zinc-900"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {t === "preview" ? "🌐 معاينة" : "📄 الكود"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screen */}
                <div ref={tvScreenRef} className="relative rounded-lg overflow-hidden bg-black ring-1 ring-zinc-800 shadow-inner aspect-video">
                  <div
                    className="pointer-events-none absolute inset-0 z-10 opacity-[0.06] mix-blend-overlay"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 3px)",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 z-10 rounded-lg shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />

                  {mode === "describe" && (analyzedSiteUrl || analyzedScreenshot) ? (
                    analyzedSiteUrl ? (
                      <iframe
                        src={analyzedSiteUrl}
                        title="analyzed site"
                        className="absolute inset-0 w-full h-full bg-white"
                        sandbox="allow-scripts allow-same-origin allow-forms"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <img
                        src={analyzedScreenshot}
                        alt="analyzed site"
                        className="absolute inset-0 w-full h-full object-contain bg-white"
                      />
                    )
                  ) : !html ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                      <div className="text-4xl mb-2 animate-pulse">📺</div>
                      <p className="text-xs">اضغط « 🚀 توليد الموقع » لعرض النتيجة هنا</p>
                    </div>
                  ) : tab === "preview" ? (
                    <iframe
                      ref={iframeRef}
                      src={previewSrc}
                      title="preview"
                      className="absolute inset-0 w-full h-full bg-white"
                      sandbox="allow-scripts allow-forms allow-modals"
                    />
                  ) : (
                    <pre className="absolute inset-0 overflow-auto p-3 text-[11px] bg-zinc-950 text-emerald-300 font-mono leading-relaxed">
                      <code>{html}</code>
                    </pre>
                  )}

                  {/* Smart mascot overlay (analyze mode) */}
                  {mode === "describe" && mascotActive && (
                    <div className="pointer-events-none absolute inset-0 z-20">
                      <div
                        className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
                        style={{ top: mascotPos.top, left: mascotPos.left }}
                      >
                        <div className="relative">
                          <div className="text-3xl animate-bounce drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">🤖</div>
                          <span className="absolute -inset-2 rounded-full bg-fuchsia-500/20 blur-xl animate-pulse" />
                        </div>
                        {mascotMessage && (
                          <div
                            dir={lang === "ar" ? "rtl" : "ltr"}
                            className="mt-2 max-w-[220px] bg-zinc-900/95 border border-fuchsia-500/40 text-[11px] text-zinc-100 rounded-lg px-2.5 py-1.5 shadow-lg shadow-fuchsia-500/20"
                          >
                            {mascotMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* TV info bar */}
                <div className="flex justify-between items-center mt-2 px-1 text-[10px] text-zinc-600 font-mono">
                  <span>CH-01 · AR/EN</span>
                  <span>{html ? `${(html.length / 1024).toFixed(1)} KB` : "—"}</span>
                </div>

                {/* Recording progress bar */}
                {isRecording && (
                  <div className="mt-2 w-full">
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden ring-1 ring-zinc-700">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-full transition-all duration-100 ease-linear"
                        style={{ width: `${Math.max(1, Math.min(100, recordingProgress))}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1 px-1">
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-mono animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        REC
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {Math.max(1, Math.min(100, Math.round(recordingProgress)))}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stand */}
          <div className="mx-auto mt-1 h-2 w-28 bg-gradient-to-b from-zinc-900 to-black rounded-b-lg shadow-md" />
          <div className="mx-auto h-1 w-48 bg-black rounded-full shadow-md" />

          {/* Smart assistant: mascot controls + log */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-100">🤖 {lang === "ar" ? "المساعد الذكي" : "Smart Assistant"}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${mascotActive ? "bg-fuchsia-600/30 text-fuchsia-200" : "bg-zinc-800 text-zinc-400"}`}>
                  {mascotActive ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "متوقف" : "Idle")}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                {lang === "ar"
                  ? "في وضع «وصف موقع موجود»، تتحرك الدمية فوق الشاشة وتشرح كل قسم بصوت ونص."
                  : "In Analyze mode, the mascot moves across the screen and explains each section with voice and text."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={startMascotTour}
                  className="text-xs px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-500"
                >
                  ▶ {lang === "ar" ? "جولة تفاعلية" : "Interactive tour"}
                </button>
                <button
                  onClick={stopTour}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                >
                  ⏹ {lang === "ar" ? "إيقاف" : "Stop"}
                </button>
                <button
                  onClick={() => speak(lastSpeech || (lang === "ar" ? "ابدأ الجولة لسماع الشرح" : "Start the tour to hear narration"))}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                >
                  🔊 {lang === "ar" ? "إعادة قراءة" : "Replay voice"}
                </button>
                <button
                  onClick={startRecording}
                  disabled={isRecording}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {isRecording
                    ? (lang === "ar" ? "⏺ جاري التسجيل..." : "⏺ Recording...")
                    : (lang === "ar" ? "🎥 تسجيل الشاشة" : "🎥 Record screen")}
                </button>
                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  >
                    ⏹ {lang === "ar" ? "إنهاء وحفظ" : "Stop & save"}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-100">📜 {lang === "ar" ? "سجل التفاعل" : "Activity log"}</h3>
                <button
                  onClick={() => setLogEntries([])}
                  className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  {lang === "ar" ? "مسح" : "Clear"}
                </button>
              </div>
              <div dir={lang === "ar" ? "rtl" : "ltr"} className="h-40 overflow-auto text-[11px] text-zinc-300 space-y-1 font-mono">
                {logEntries.length === 0 ? (
                  <p className="text-zinc-500">{lang === "ar" ? "لا توجد أحداث بعد." : "No events yet."}</p>
                ) : (
                  logEntries.map((l, i) => (
                    <p key={i} className="border-b border-zinc-800/60 pb-1">{l}</p>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Voice controls + recorded video preview + explainer person */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Voice picker */}
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">
                🎙️ {lang === "ar" ? "إعدادات الصوت" : "Voice settings"}
              </h3>
              <div className="space-y-2">
                <div className="flex gap-1 bg-zinc-950 rounded-md p-0.5 text-[10px]">
                  {(["all", "ar", "fr", "en"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setVoiceLangFilter(f)}
                      className={`flex-1 px-2 py-1 rounded ${
                        voiceLangFilter === f ? "bg-zinc-200 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {f === "all" ? (lang === "ar" ? "الكل" : "All") : f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-md p-1.5"
                >
                  {(voiceLangFilter === "all"
                    ? voices
                    : voices.filter((v) => v.lang?.toLowerCase().startsWith(voiceLangFilter))
                  ).map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                  {voices.length === 0 && <option value="">{lang === "ar" ? "لا توجد أصوات" : "No voices"}</option>}
                </select>
                <label className="block text-[11px] text-zinc-400">
                  {lang === "ar" ? "السرعة" : "Rate"}: {speechRate.toFixed(2)}
                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="block text-[11px] text-zinc-400">
                  {lang === "ar" ? "الطبقة" : "Pitch"}: {speechPitch.toFixed(2)}
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={speechPitch}
                    onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </label>
                <button
                  onClick={() =>
                    speak(
                      lang === "ar"
                        ? "هذا اختبار للصوت المحدد. مرحباً بك في المساعد الذكي."
                        : "This is a test of the selected voice. Welcome to the smart assistant.",
                    )
                  }
                  className="w-full text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                >
                  🔉 {lang === "ar" ? "تجربة الصوت" : "Test voice"}
                </button>
              </div>
            </div>

            {/* Recorded video preview */}
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">
                📹 {lang === "ar" ? "الفيديو المسجّل" : "Recorded video"}
              </h3>
              <div className="space-y-2">
                {recordedVideoUrl ? (
                  <video
                    src={recordedVideoUrl}
                    controls
                    className="w-full rounded-lg bg-black aspect-video"
                  />
                ) : (
                  <div className="w-full aspect-video rounded-lg bg-black/60 border border-dashed border-zinc-700 flex items-center justify-center text-xs text-zinc-500 text-center px-3">
                    {lang === "ar"
                      ? "اضغط « تسجيل الشاشة » ثم « إنهاء وحفظ » لتظهر المعاينة هنا."
                      : "Click Record then Stop & save to see the preview here."}
                  </div>
                )}
                <button
                  onClick={downloadVideoToChosenLocation}
                  disabled={!recordedVideoUrl}
                  className="w-full text-center text-sm font-semibold px-3 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed transition"
                >
                  📥 {lang === "ar" ? "تحميل الفيديو (اختر الموقع)" : "Download video (choose location)"}
                </button>
                {recordedVideoUrl && (
                  <a
                    href={recordedVideoUrl}
                    download={`explainer_${Date.now()}.webm`}
                    className="block w-full text-center text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  >
                    ⬇️ {lang === "ar" ? "تحميل سريع" : "Quick download"}
                  </a>
                )}
              </div>
            </div>

            {/* Explainer person */}
            <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4 flex flex-col">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">
                🧑‍🏫 {lang === "ar" ? "الشارح الافتراضي" : "Virtual presenter"}
              </h3>
              <div className="flex-1 flex gap-3">
                <div className="text-5xl select-none animate-pulse" aria-hidden>
                  🧑‍💼
                </div>
                <div
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  className="flex-1 bg-zinc-950/60 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 min-h-[80px]"
                >
                  {mascotMessage ||
                    (lang === "ar"
                      ? "اختر الصوت من الأعلى، ثم اضغط على « جولة تفاعلية » وسأشرح لك كل قسم من الموقع بصوت احترافي."
                      : "Pick a voice above, then click Interactive tour — I will narrate each section of the site professionally.")}
                </div>
              </div>
              <button
                onClick={() =>
                  speak(
                    lang === "ar"
                      ? "مرحباً، أنا الشارح الافتراضي. سأقدّم لك الموقع قسماً قسماً مع شرح للألوان والمحتوى والتفاعل."
                      : "Hello, I am your virtual presenter. I will walk you through the site section by section.",
                  )
                }
                className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-500"
              >
                🎤 {lang === "ar" ? "اشرح الموقع" : "Explain the site"}
              </button>
            </div>
          </div>

          {/* Sound effects library */}
          <div className="mt-5 bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">
              🎵 {lang === "ar" ? "مكتبة الأصوات" : "Sound effects"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { id: "click", ar: "🖱️ نقرة", en: "🖱️ Click" },
                { id: "ding", ar: "🔔 جرس", en: "🔔 Ding" },
                { id: "success", ar: "✅ نجاح", en: "✅ Success" },
                { id: "error", ar: "❌ خطأ", en: "❌ Error" },
                { id: "notify", ar: "📨 تنبيه", en: "📨 Notify" },
                { id: "swoosh", ar: "💨 انتقال", en: "💨 Swoosh" },
                { id: "applause", ar: "👏 تصفيق", en: "👏 Applause" },
                { id: "magic", ar: "✨ سحر", en: "✨ Magic" },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    playSfx(s.id);
                    addLog(`🎵 ${lang === "ar" ? s.ar : s.en}`);
                  }}
                  className="text-xs px-2 py-2 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
                >
                  {lang === "ar" ? s.ar : s.en}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              {lang === "ar"
                ? "اضغط أي صوت لتجربته. تُولَّد الأصوات في المتصفح دون أي ملفات خارجية."
                : "Click any sound to preview. Generated in-browser, no external files."}
            </p>
          </div>


        </section>
      </main>

      <footer className="text-center text-xs text-zinc-400 py-6">
        مولّد مواقع ذكي — يدعم العربية والإنجليزية · بدون خادم، يعمل بالكامل في متصفحك.
      </footer>
    </div>
  );
}
