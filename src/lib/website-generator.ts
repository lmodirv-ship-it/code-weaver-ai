// Smart rules-based website generator (Arabic + English)
export type TemplateName = "default" | "bootstrap" | "tailwind";

const COLORS: Record<string, string> = {
  أحمر: "#ef4444", red: "#ef4444",
  أزرق: "#3b82f6", blue: "#3b82f6",
  أخضر: "#22c55e", green: "#22c55e",
  أسود: "#0f172a", black: "#0f172a",
  أبيض: "#ffffff", white: "#ffffff",
  رمادي: "#6b7280", gray: "#6b7280",
  بنفسجي: "#8b5cf6", purple: "#8b5cf6",
  وردي: "#ec4899", pink: "#ec4899",
  برتقالي: "#f97316", orange: "#f97316",
  أصفر: "#eab308", yellow: "#eab308",
};

const has = (s: string, ...keys: string[]) => keys.some((k) => s.includes(k));

function extractTitle(desc: string): string {
  const m = desc.match(/(?:عن|لـ|ل\s|about|for)\s+([^\n.،,]{2,40})/i);
  if (m) return m[1].trim();
  const first = desc.split(/[\n.،,]/)[0].trim();
  return first.slice(0, 60) || "موقعي الجديد";
}

function pickBg(desc: string): string {
  for (const [name, code] of Object.entries(COLORS)) {
    if (desc.includes(name)) return code;
  }
  return "#f8fafc";
}

function buildSections(desc: string, isArabic: boolean): string {
  const t = (ar: string, en: string) => (isArabic ? ar : en);
  const sections: string[] = [];
  const title = extractTitle(desc);

  // Navbar
  if (has(desc, "navbar", "شريط", "قائمة علوية", "header", "هيدر") || true) {
    sections.push(`
<nav class="nav">
  <div class="nav-inner">
    <div class="brand">${title}</div>
    <div class="nav-links">
      <a href="#home">${t("الرئيسية", "Home")}</a>
      <a href="#features">${t("المميزات", "Features")}</a>
      <a href="#about">${t("عن", "About")}</a>
      <a href="#contact">${t("اتصل", "Contact")}</a>
    </div>
  </div>
</nav>`);
  }

  // Hero
  sections.push(`
<section id="home" class="hero">
  <div class="container">
    <h1>${title}</h1>
    <p class="lead">${t("تجربة عصرية، تصميم نظيف، وأداء سريع — كل ما تحتاجه في مكان واحد.", "A modern experience, clean design, and fast performance — all in one place.")}</p>
    <div class="cta-row">
      <button class="btn btn-primary" onclick="alert('${t("مرحباً بك!", "Welcome!")}')">${t("ابدأ الآن", "Get Started")}</button>
      <button class="btn btn-ghost">${t("اعرف المزيد", "Learn more")}</button>
    </div>
  </div>
</section>`);

  // Features / cards
  if (has(desc, "card", "بطاقة", "feature", "ميزة", "خدم", "service") || true) {
    sections.push(`
<section id="features" class="section">
  <div class="container">
    <h2>${t("المميزات", "Features")}</h2>
    <div class="grid">
      <div class="card"><div class="card-icon">⚡</div><h3>${t("سريع", "Fast")}</h3><p>${t("أداء فائق على جميع الأجهزة.", "Blazing fast on every device.")}</p></div>
      <div class="card"><div class="card-icon">🎨</div><h3>${t("جميل", "Beautiful")}</h3><p>${t("تصميم عصري متجاوب.", "Modern responsive design.")}</p></div>
      <div class="card"><div class="card-icon">🔒</div><h3>${t("آمن", "Secure")}</h3><p>${t("حماية كاملة لبياناتك.", "Full protection for your data.")}</p></div>
    </div>
  </div>
</section>`);
  }

  // Image
  if (has(desc, "image", "صورة", "صور", "معرض", "gallery")) {
    sections.push(`
<section class="section">
  <div class="container">
    <h2>${t("معرض الصور", "Gallery")}</h2>
    <div class="grid">
      <img src="https://picsum.photos/seed/a/600/400" alt="">
      <img src="https://picsum.photos/seed/b/600/400" alt="">
      <img src="https://picsum.photos/seed/c/600/400" alt="">
    </div>
  </div>
</section>`);
  }

  // List
  if (has(desc, "list", "قائمة", "نقاط")) {
    sections.push(`
<section class="section">
  <div class="container">
    <h2>${t("قائمتنا", "Our List")}</h2>
    <ul class="bullets">
      <li>${t("عنصر أول مع تفاصيل واضحة", "First item with clear details")}</li>
      <li>${t("عنصر ثاني مفيد", "Second helpful item")}</li>
      <li>${t("عنصر ثالث مميز", "Third highlight item")}</li>
    </ul>
  </div>
</section>`);
  }

  // Table
  if (has(desc, "table", "جدول", "أسعار", "pricing")) {
    sections.push(`
<section class="section">
  <div class="container">
    <h2>${t("الأسعار", "Pricing")}</h2>
    <table class="tbl">
      <thead><tr><th>${t("الخطة", "Plan")}</th><th>${t("السعر", "Price")}</th><th>${t("المميزات", "Features")}</th></tr></thead>
      <tbody>
        <tr><td>${t("مجاني", "Free")}</td><td>$0</td><td>${t("أساسي", "Basic")}</td></tr>
        <tr><td>Pro</td><td>$9</td><td>${t("جميع المميزات", "All features")}</td></tr>
        <tr><td>Team</td><td>$29</td><td>${t("للفريق", "For teams")}</td></tr>
      </tbody>
    </table>
  </div>
</section>`);
  }

  // Form / contact
  if (has(desc, "form", "نموذج", "تواصل", "اتصل", "contact")) {
    sections.push(`
<section id="contact" class="section section-alt">
  <div class="container narrow">
    <h2>${t("تواصل معنا", "Contact us")}</h2>
    <form onsubmit="event.preventDefault();alert('${t("تم الإرسال!", "Sent!")}')">
      <input type="text" placeholder="${t("الاسم", "Name")}" required>
      <input type="email" placeholder="${t("البريد", "Email")}" required>
      <textarea placeholder="${t("رسالتك", "Your message")}" rows="4"></textarea>
      <button class="btn btn-primary" type="submit">${t("إرسال", "Send")}</button>
    </form>
  </div>
</section>`);
  }

  // Footer
  sections.push(`
<footer class="footer">
  <div class="container">
    <p>© ${new Date().getFullYear()} ${title} — ${t("جميع الحقوق محفوظة", "All rights reserved")}</p>
  </div>
</footer>`);

  return sections.join("\n");
}

function baseStyles(bg: string, isArabic: boolean): string {
  return `
:root { --bg:${bg}; --fg:#0f172a; --muted:#64748b; --card:#ffffff; --border:#e2e8f0; --primary:#3b82f6; --primary-fg:#fff; }
*{box-sizing:border-box}
body{margin:0;font-family:${isArabic ? "'Tajawal','Cairo'," : ""}'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;direction:${isArabic ? "rtl" : "ltr"}}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.container.narrow{max-width:640px}
.nav{position:sticky;top:0;background:rgba(255,255,255,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);z-index:10}
.nav-inner{max-width:1100px;margin:0 auto;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:700;font-size:18px}
.nav-links a{margin:0 10px;color:var(--fg);text-decoration:none;font-size:14px}
.nav-links a:hover{color:var(--primary)}
.hero{padding:80px 0 60px;text-align:center}
.hero h1{font-size:clamp(32px,5vw,56px);margin:0 0 16px;font-weight:800;letter-spacing:-.02em}
.lead{font-size:18px;color:var(--muted);max-width:640px;margin:0 auto 28px}
.cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn{padding:12px 24px;border-radius:10px;border:0;font-size:15px;font-weight:600;cursor:pointer;transition:transform .15s,box-shadow .15s}
.btn:hover{transform:translateY(-1px)}
.btn-primary{background:var(--primary);color:var(--primary-fg);box-shadow:0 4px 14px rgba(59,130,246,.35)}
.btn-ghost{background:transparent;color:var(--fg);border:1px solid var(--border)}
.section{padding:64px 0}
.section-alt{background:#fff}
.section h2{font-size:32px;margin:0 0 32px;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,.08)}
.card-icon{font-size:32px;margin-bottom:12px}
.card h3{margin:0 0 8px;font-size:18px}
.card p{margin:0;color:var(--muted)}
.bullets{list-style:none;padding:0}
.bullets li{padding:12px 16px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:8px}
.tbl{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.tbl th,.tbl td{padding:14px;text-align:${isArabic ? "right" : "left"};border-bottom:1px solid var(--border)}
.tbl th{background:#f1f5f9;font-weight:600}
form{display:flex;flex-direction:column;gap:12px}
form input,form textarea{padding:12px 14px;border:1px solid var(--border);border-radius:10px;font-size:15px;font-family:inherit}
form input:focus,form textarea:focus{outline:0;border-color:var(--primary)}
img{max-width:100%;border-radius:12px;display:block}
.grid img{height:100%;object-fit:cover}
.footer{padding:32px 0;text-align:center;color:var(--muted);border-top:1px solid var(--border);background:#fff;margin-top:40px}
`;
}

function bootstrapShell(title: string, body: string, isArabic: boolean): string {
  return `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap${isArabic ? ".rtl" : ""}.min.css" rel="stylesheet">
</head><body class="bg-light">${body}
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body></html>`;
}

function tailwindShell(title: string, body: string, isArabic: boolean): string {
  return `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="bg-slate-50 text-slate-900">${body}</body></html>`;
}

export function generateWebsite(description: string, template: TemplateName = "default"): string {
  const isArabic = /[\u0600-\u06FF]/.test(description);
  const bg = pickBg(description);
  const title = extractTitle(description);
  const body = buildSections(description, isArabic);

  if (template === "bootstrap" || template === "tailwind") {
    // Wrap with simple CSS too so layout is identical
    const shell = template === "bootstrap" ? bootstrapShell : tailwindShell;
    return shell(title, `<style>${baseStyles(bg, isArabic)}</style>${body}`, isArabic);
  }

  return `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
<style>${baseStyles(bg, isArabic)}</style>
</head>
<body>
${body}
</body>
</html>`;
}
