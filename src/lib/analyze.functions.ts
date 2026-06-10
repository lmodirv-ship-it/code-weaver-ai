import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().trim().max(2000).optional().default(""),
  imageDataUrl: z.string().max(8_000_000).optional().default(""),
  lang: z.enum(["ar", "en"]).default("ar"),
});

export const analyzeWebsite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { url, imageDataUrl, lang } = data;
    if (!url && !imageDataUrl) {
      throw new Error(lang === "ar" ? "أدخل رابط الموقع أو ارفع صورة" : "Provide a URL or upload an image");
    }

    // If URL provided, fetch HTML and extract text/meta
    let pageContext = "";
    if (url) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 LovableBot" },
          signal: AbortSignal.timeout(15000),
        });
        const html = (await res.text()).slice(0, 120_000);
        pageContext = html;
      } catch (e) {
        pageContext = `(تعذر جلب الصفحة: ${(e as Error).message})`;
      }
    }

    const systemPrompt =
      lang === "ar"
        ? "أنت محلل واجهات مواقع محترف. قدّم وصفاً عربياً واضحاً ومنظماً للموقع: الغرض، الأقسام الرئيسية، نظام الألوان، الخطوط، التخطيط، عناصر التفاعل، نقاط القوة والضعف، واقتراحات تحسين. استخدم عناوين Markdown وقوائم نقطية."
        : "You are an expert web UI analyst. Provide a clear, structured description of the website: purpose, main sections, color palette, typography, layout, interactive elements, strengths, weaknesses, and improvement suggestions. Use Markdown headings and bullet lists.";

    const userContent: Array<Record<string, unknown>> = [];
    if (url) {
      userContent.push({
        type: "text",
        text:
          (lang === "ar" ? "حلّل هذا الموقع: " : "Analyze this website: ") +
          url +
          (pageContext ? `\n\nHTML (truncated):\n${pageContext.slice(0, 40_000)}` : ""),
      });
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
    return { description: typeof content === "string" ? content : JSON.stringify(content) };
  });
