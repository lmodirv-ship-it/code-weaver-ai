import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().trim().max(2000).optional().default(""),
  imageDataUrl: z.string().max(8_000_000).optional().default(""),
  lang: z.enum(["ar", "en"]).default("ar"),
});

// Extract clean, AI-friendly context from raw HTML
function extractContext(html: string, url: string): { text: string; pages: string[] } {
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? "";
  const all = (re: RegExp) => {
    const out: string[] = [];
    let m;
    while ((m = re.exec(html)) !== null) out.push(m[1].trim());
    return out;
  };

  const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const lang = pick(/<html[^>]+lang=["']([^"']+)["']/i);
  const h1 = all(/<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((s) => s.replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 5);
  const h2 = all(/<h2[^>]*>([\s\S]*?)<\/h2>/gi).map((s) => s.replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 12);
  const navLinks = all(/<a[^>]*>([\s\S]*?)<\/a>/gi)
    .map((s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && s.length < 40)
    .slice(0, 20);

  // Collect internal page URLs (same host) for page-count detection
  const hrefs = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)).map((m) => m[1]);
  const pages = new Set<string>();
  try {
    const base = new URL(url);
    pages.add(base.pathname || "/");
    for (const h of hrefs) {
      try {
        const u = new URL(h, base);
        if (u.host !== base.host) continue;
        if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|pdf|zip|mp4|webm|woff2?)$/i.test(u.pathname)) continue;
        pages.add(u.pathname || "/");
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // Visible body text
  const body = (html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  const pageList = Array.from(pages).sort();
  const text = [
    `URL: ${url}`,
    lang && `HTML lang: ${lang}`,
    title && `Title: ${title}`,
    (desc || ogDesc) && `Meta description: ${desc || ogDesc}`,
    ogTitle && ogTitle !== title && `OG title: ${ogTitle}`,
    h1.length && `H1: ${h1.join(" | ")}`,
    h2.length && `H2: ${h2.join(" | ")}`,
    navLinks.length && `Nav/links sample: ${navLinks.join(" · ")}`,
    pageList.length && `Internal pages detected (${pageList.length}): ${pageList.slice(0, 30).join(" · ")}`,
    body && `Visible text (truncated): ${body}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { text, pages: pageList };
}

export const analyzeWebsite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { url, imageDataUrl, lang } = data;
    if (!url && !imageDataUrl) {
      throw new Error(lang === "ar" ? "أدخل رابط الموقع أو ارفع صورة" : "Provide a URL or upload an image");
    }

    // Fetch + extract clean context
    let pageContext = "";
    let screenshotUrl = "";
    if (url) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LovableAnalyzer/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        const html = await res.text();
        pageContext = extractContext(html, url);
      } catch (e) {
        pageContext = `(Could not fetch page: ${(e as Error).message}) URL: ${url}`;
      }
      // Public screenshot service (no key) — lets the vision model see the real site
      screenshotUrl = `https://image.thum.io/get/width/1280/crop/900/noanimate/${url}`;
    }

    const systemPrompt =
      lang === "ar"
        ? "أنت محلل واجهات مواقع محترف. اعتمد فقط على البيانات المُعطاة (لقطة الشاشة + النص المستخرج). صف الموقع بدقة كما هو فعلياً: الغرض، الأقسام الرئيسية، نظام الألوان، الخطوط، التخطيط، عناصر التفاعل، نقاط القوة والضعف، واقتراحات تحسين. لا تخترع محتوى غير موجود. استخدم Markdown مع عناوين وقوائم نقطية."
        : "You are an expert web UI analyst. Use ONLY the provided screenshot and extracted text. Describe the site as it actually is: purpose, main sections, color palette, typography, layout, interactive elements, strengths, weaknesses, and improvement suggestions. Do not invent content. Use Markdown with headings and bullet lists.";

    const userContent: Array<Record<string, unknown>> = [];

    if (url) {
      userContent.push({
        type: "text",
        text:
          (lang === "ar" ? "حلّل هذا الموقع بدقة:\n" : "Analyze this site precisely:\n") +
          pageContext,
      });
      if (screenshotUrl) {
        userContent.push({
          type: "image_url",
          image_url: { url: screenshotUrl },
        });
      }
    }
    if (imageDataUrl) {
      userContent.push({
        type: "text",
        text: lang === "ar" ? "حلّل لقطة الواجهة التالية:" : "Analyze this UI screenshot:",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: imageDataUrl },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error(lang === "ar" ? "تجاوزت حد الطلبات، حاول لاحقاً" : "Rate limit exceeded");
      if (res.status === 402) throw new Error(lang === "ar" ? "نفدت أرصدة الذكاء الاصطناعي" : "AI credits exhausted");
      throw new Error(`AI Gateway error ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    return {
      description: typeof content === "string" ? content : JSON.stringify(content),
      screenshotUrl,
    };
  });
