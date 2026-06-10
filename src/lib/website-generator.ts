// Smart rules-based website generator (Arabic + English)
// Enhanced with: SEO injection, dark mode, toasts, smooth scroll,
// stats / testimonials / FAQ / pricing / gallery sections.
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

const has = (s: string, ...keys: string[]) =>
  keys.some((k) => s.toLowerCase().includes(k.toLowerCase()));

function extractTitle(desc: string): string {
  const m = desc.match(/(?:عن|لـ|ل\s|about|for)\s+([^\n.،,]{2,40})/i);
  if (m) return m[1].trim();
  const first = desc.split(/[\n.،,]/)[0].trim();
  return first.slice(0, 60) || "موقعي الجديد";
}

function extractKeywords(desc: string): string[] {
  return Array.from(
    new Set(
      desc
        .replace(/[.,،\n]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 10),
    ),
  );
}

function pickPrimary(desc: string): string {
  for (const [name, code] of Object.entries(COLORS)) {
    if (desc.includes(name)) return code;
  }
  return "#3b82f6";
}

function buildSections(desc: string, isArabic: boolean, primary: string): string {
  const t = (ar: string, en: string) => (isArabic ? ar : en);
  const sections: string[] = [];
  const title = extractTitle(desc);

  // Navbar (always)
  sections.push(`
<nav class="nav">
  <div class="nav-inner">
    <div class="brand">${title}</div>
    <div class="nav-links">
      <a href="#home">${t("الرئيسية", "Home")}</a>
      <a href="#features">${t("المميزات", "Features")}</a>
      <a href="#about">${t("عن", "About")}</a>
      <a href="#contact">${t("اتصل", "Contact")}</a>
      <button class="theme-toggle" onclick="toggleTheme()" title="${t("الوضع الليلي", "Dark mode")}">🌓</button>
    </div>
  </div>
</nav>`);

  // Hero
  sections.push(`
<section id="home" class="hero">
  <div class="container">
    <span class="badge">✨ ${t("جديد", "New")}</span>
    <h1>${title}</h1>
    <p class="lead">${t("تجربة عصرية، تصميم نظيف، وأداء سريع — كل ما تحتاجه في مكان واحد.", "A modern experience, clean design, and fast performance — all in one place.")}</p>
    <div class="cta-row">
      <button class="btn btn-primary" onclick="toast('${t("مرحباً بك!", "Welcome!")}','success')">${t("ابدأ الآن", "Get Started")}</button>
      <button class="btn btn-ghost" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})">${t("اعرف المزيد", "Learn more")}</button>
    </div>
  </div>
</section>`);

  // Stats
  if (has(desc, "stat", "إحصائ", "أرقام")) {
    sections.push(`
<section class="section">
  <div class="container stats">
    <div><strong>10K+</strong><span>${t("مستخدم", "Users")}</span></div>
    <div><strong>99%</strong><span>${t("رضا", "Satisfaction")}</span></div>
    <div><strong>24/7</strong><span>${t("دعم", "Support")}</span></div>
    <div><strong>50+</strong><span>${t("دولة", "Countries")}</span></div>
  </div>
</section>`);
  }

  // Features
  sections.push(`
<section id="features" class="section">
  <div class="container">
    <h2>${t("المميزات", "Features")}</h2>
    <div class="grid">
      <div class="card"><div class="card-icon">⚡</div><h3>${t("سريع", "Fast")}</h3><p>${t("أداء فائق على جميع الأجهزة.", "Blazing fast on every device.")}</p></div>
      <div class="card"><div class="card-icon">🎨</div><h3>${t("جميل", "Beautiful")}</h3><p>${t("تصميم عصري متجاوب.", "Modern responsive design.")}</p></div>
      <div class="card"><div class="card-icon">🔒</div><h3>${t("آمن", "Secure")}</h3><p>${t("حماية كاملة لبياناتك.", "Full protection for your data.")}</p></div>
      <div class="card"><div class="card-icon">🌍</div><h3>${t("عالمي", "Global")}</h3><p>${t("متعدد اللغات.", "Multi-language ready.")}</p></div>
    </div>
  </div>
</section>`);

  // Gallery
  if (has(desc, "image", "صورة", "صور", "معرض", "gallery")) {
    sections.push(`
<section class="section section-alt">
  <div class="container">
    <h2>${t("معرض الصور", "Gallery")}</h2>
    <div class="grid grid-img">
      ${[1, 2, 3, 4, 5, 6].map((i) => `<img loading="lazy" src="https://picsum.photos/seed/${i}/600/400" alt="${t("صورة", "Image")} ${i}">`).join("")}
    </div>
  </div>
</section>`);
  }

  // Testimonials
  if (has(desc, "testimonial", "آراء", "شهادات", "review")) {
    sections.push(`
<section class="section">
  <div class="container">
    <h2>${t("آراء العملاء", "Testimonials")}</h2>
    <div class="grid">
      <div class="card"><p>"${t("منتج رائع وأداء ممتاز!", "Amazing product, great performance!")}"</p><strong>— Ahmed</strong></div>
      <div class="card"><p>"${t("غيّر طريقة عملنا بالكامل.", "Changed how we work entirely.")}"</p><strong>— Sara</strong></div>
      <div class="card"><p>"${t("دعم سريع وفريق محترف.", "Fast support and pro team.")}"</p><strong>— John</strong></div>
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
      <li>✓ ${t("عنصر أول مع تفاصيل واضحة", "First item with clear details")}</li>
      <li>✓ ${t("عنصر ثاني مفيد", "Second helpful item")}</li>
      <li>✓ ${t("عنصر ثالث مميز", "Third highlight item")}</li>
    </ul>
  </div>
</section>`);
  }

  // Pricing table
  if (has(desc, "table", "جدول", "أسعار", "pricing", "price")) {
    sections.push(`
<section class="section section-alt">
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

  // FAQ
  if (has(desc, "faq", "أسئلة", "سؤال")) {
    sections.push(`
<section class="section">
  <div class="container narrow">
    <h2>${t("الأسئلة الشائعة", "FAQ")}</h2>
    <details><summary>${t("كيف أبدأ؟", "How do I start?")}</summary><p>${t("سجل حساباً مجانياً وابدأ فوراً.", "Sign up for free and start instantly.")}</p></details>
    <details><summary>${t("هل هناك نسخة مجانية؟", "Is there a free version?")}</summary><p>${t("نعم، تصلح للأفراد.", "Yes, suitable for individuals.")}</p></details>
    <details><summary>${t("كيف أتواصل مع الدعم؟", "How to contact support?")}</summary><p>${t("عبر نموذج التواصل أدناه.", "Through the contact form below.")}</p></details>
  </div>
</section>`);
  }

  // Contact
  if (has(desc, "form", "نموذج", "تواصل", "اتصل", "contact")) {
    sections.push(`
<section id="contact" class="section section-alt">
  <div class="container narrow">
    <h2>${t("تواصل معنا", "Contact us")}</h2>
    <form onsubmit="event.preventDefault();toast('${t("تم الإرسال!", "Sent!")}','success');this.reset()">
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

function baseStyles(primary: string, isArabic: boolean): string {
  return `
:root { --bg:#f8fafc; --fg:#0f172a; --muted:#64748b; --card:#ffffff; --border:#e2e8f0; --primary:${primary}; --primary-fg:#fff; }
:root.dark { --bg:#0f172a; --fg:#f1f5f9; --muted:#94a3b8; --card:#1e293b; --border:#334155; }
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:${isArabic ? "'Tajawal','Cairo'," : ""}'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;direction:${isArabic ? "rtl" : "ltr"};transition:background .25s,color .25s}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.container.narrow{max-width:680px}
.nav{position:sticky;top:0;background:color-mix(in oklab,var(--bg) 85%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);z-index:10}
.nav-inner{max-width:1100px;margin:0 auto;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.brand{font-weight:700;font-size:18px}
.nav-links{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nav-links a{padding:6px 10px;color:var(--fg);text-decoration:none;font-size:14px;border-radius:6px}
.nav-links a:hover{color:var(--primary);background:color-mix(in oklab,var(--primary) 10%,transparent)}
.theme-toggle{background:transparent;border:1px solid var(--border);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:14px}
.hero{padding:90px 0 70px;text-align:center}
.badge{display:inline-block;background:color-mix(in oklab,var(--primary) 15%,transparent);color:var(--primary);padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:16px}
.hero h1{font-size:clamp(34px,5vw,60px);margin:0 0 16px;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,var(--fg),var(--primary));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.lead{font-size:18px;color:var(--muted);max-width:640px;margin:0 auto 28px}
.cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn{padding:12px 24px;border-radius:10px;border:0;font-size:15px;font-weight:600;cursor:pointer;transition:transform .15s,box-shadow .15s}
.btn:hover{transform:translateY(-1px)}
.btn-primary{background:var(--primary);color:var(--primary-fg);box-shadow:0 4px 14px color-mix(in oklab,var(--primary) 35%,transparent)}
.btn-ghost{background:transparent;color:var(--fg);border:1px solid var(--border)}
.section{padding:64px 0}
.section-alt{background:color-mix(in oklab,var(--primary) 4%,var(--bg))}
.section h2{font-size:32px;margin:0 0 32px;font-weight:700;text-align:center}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
.grid-img{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,.08)}
.card-icon{font-size:32px;margin-bottom:12px}
.card h3{margin:0 0 8px;font-size:18px}
.card p{margin:0 0 8px;color:var(--muted)}
.bullets{list-style:none;padding:0}
.bullets li{padding:14px 18px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:10px}
.tbl{width:100%;border-collapse:collapse;background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.tbl th,.tbl td{padding:14px;text-align:${isArabic ? "right" : "left"};border-bottom:1px solid var(--border)}
.tbl th{background:color-mix(in oklab,var(--primary) 8%,var(--card));font-weight:600}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px;text-align:center}
.stats strong{display:block;font-size:36px;font-weight:800;color:var(--primary)}
.stats span{color:var(--muted);font-size:14px}
details{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:10px}
details summary{cursor:pointer;font-weight:600}
details p{margin:10px 0 0;color:var(--muted)}
form{display:flex;flex-direction:column;gap:12px}
form input,form textarea{padding:12px 14px;border:1px solid var(--border);border-radius:10px;font-size:15px;font-family:inherit;background:var(--card);color:var(--fg)}
form input:focus,form textarea:focus{outline:0;border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in oklab,var(--primary) 20%,transparent)}
img{max-width:100%;border-radius:12px;display:block}
.grid-img img{height:220px;object-fit:cover;width:100%}
.footer{padding:32px 0;text-align:center;color:var(--muted);border-top:1px solid var(--border);background:var(--card);margin-top:40px}
.toast{position:fixed;bottom:24px;${isArabic ? "left" : "right"}:24px;background:var(--card);color:var(--fg);border:1px solid var(--border);border-${isArabic ? "left" : "right"}:4px solid var(--primary);padding:14px 18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.15);animation:slideIn .25s ease;z-index:1000;font-weight:500}
.toast.success{border-color:#22c55e}
.toast.error{border-color:#ef4444}
@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
`;
}

const RUNTIME_JS = `
function toggleTheme(){
  const r=document.documentElement;
  r.classList.toggle('dark');
  try{localStorage.setItem('theme',r.classList.contains('dark')?'dark':'light')}catch(e){}
}
(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})();
function toast(msg,type){
  const t=document.createElement('div');
  t.className='toast '+(type||'');
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},2500);
}
`;

function seoMeta(title: string, desc: string, keywords: string[], isArabic: boolean): string {
  const description = desc.replace(/"/g, "'").slice(0, 155);
  return `
<meta name="description" content="${description}">
<meta name="keywords" content="${keywords.join(", ")}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="theme-color" content="#3b82f6">
<meta http-equiv="content-language" content="${isArabic ? "ar" : "en"}">`;
}

function bootstrapShell(title: string, head: string, body: string, isArabic: boolean): string {
  return `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>${head}
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap${isArabic ? ".rtl" : ""}.min.css" rel="stylesheet">
</head><body>${body}
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script>${RUNTIME_JS}</script>
</body></html>`;
}

function tailwindShell(title: string, head: string, body: string, isArabic: boolean): string {
  return `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>${head}
<script src="https://cdn.tailwindcss.com"></script>
</head><body>${body}<script>${RUNTIME_JS}</script></body></html>`;
}

export function generateWebsite(description: string, template: TemplateName = "default"): string {
  const isArabic = /[\u0600-\u06FF]/.test(description);
  const primary = pickPrimary(description);
  const title = extractTitle(description);
  const keywords = extractKeywords(description);
  const body = buildSections(description, isArabic, primary);
  const seo = seoMeta(title, description, keywords, isArabic);

  if (template === "bootstrap" || template === "tailwind") {
    const shell = template === "bootstrap" ? bootstrapShell : tailwindShell;
    return shell(title, seo, `<style>${baseStyles(primary, isArabic)}</style>${body}`, isArabic);
  }

  return `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
${seo}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
<style>${baseStyles(primary, isArabic)}</style>
</head>
<body>
${body}
<script>${RUNTIME_JS}</script>
</body>
</html>`;
}
