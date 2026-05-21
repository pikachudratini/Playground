// Renders a self-contained animated static site from a build model.
// Returns { html, css, js } as strings.

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function googleFontsUrl(families) {
  const params = [...new Set(families)]
    .filter(Boolean)
    .map(
      (f) =>
        `family=${encodeURIComponent(f.trim()).replace(/%20/g, '+')}:wght@400;500;600;700`,
    )
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

function renderCss(model) {
  const { palette: p, typography: t, motion: m } = model;
  return `:root {
  --bg: ${p.bg};
  --surface: ${p.surface};
  --surface-alt: ${p.surfaceAlt};
  --text: ${p.text};
  --muted: ${p.muted};
  --border: ${p.border};
  --primary: ${p.primary};
  --accent: ${p.accent};
  --on-primary: ${p.onPrimary};
  --font-heading: ${t.heading};
  --font-body: ${t.body};
  --dur: ${m.duration};
  --ease: ${m.easing};
  --reveal-y: ${m.revealY};
  --maxw: 1140px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }
h1, h2, h3 { font-family: var(--font-heading); line-height: 1.1; font-weight: 700; }

.skip {
  position: absolute; left: -999px; top: 0;
  background: var(--primary); color: var(--on-primary);
  padding: 10px 16px; border-radius: 8px; z-index: 100;
}
.skip:focus { left: 16px; top: 16px; }

.wrap { width: 100%; max-width: var(--maxw); margin: 0 auto; padding: 0 24px; }

/* ---- nav ---- */
.nav {
  position: sticky; top: 0; z-index: 50;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
  border-bottom: 1px solid transparent;
}
.nav.scrolled {
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-bottom-color: var(--border);
}
.nav .wrap {
  display: flex; align-items: center; justify-content: space-between;
  height: 72px;
}
.brand { display: flex; align-items: center; gap: 12px; font-weight: 700; }
.brand img { width: 34px; height: 34px; }
.nav-links { display: flex; gap: 28px; align-items: center; }
.nav-links a { color: var(--muted); font-size: 15px; transition: color var(--dur) var(--ease); }
.nav-links a:hover { color: var(--text); }

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 22px; border-radius: 999px;
  font-weight: 600; font-size: 15px; cursor: pointer;
  border: 1px solid transparent;
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.btn-primary {
  background: var(--primary); color: var(--on-primary);
  box-shadow: 0 8px 24px -10px color-mix(in srgb, var(--primary) 70%, transparent);
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 32px -10px color-mix(in srgb, var(--primary) 80%, transparent); }
.btn-ghost { border-color: var(--border); color: var(--text); }
.btn-ghost:hover { transform: translateY(-2px); background: var(--surface); }

/* ---- hero ---- */
.hero { padding: 88px 0 96px; position: relative; }
.hero::before {
  content: ""; position: absolute; inset: -10% -20% auto -20%; height: 620px;
  background: radial-gradient(60% 60% at 30% 20%, color-mix(in srgb, var(--primary) 40%, transparent), transparent 70%),
    radial-gradient(50% 50% at 85% 10%, color-mix(in srgb, var(--accent) 36%, transparent), transparent 70%);
  z-index: -1; filter: blur(10px);
}
.hero .wrap {
  display: grid; grid-template-columns: 1.05fr 0.95fr;
  gap: 56px; align-items: center;
}
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--border); border-radius: 999px;
  padding: 6px 14px;
}
.hero h1 {
  font-size: clamp(2.6rem, 5.4vw, 4.1rem);
  margin: 22px 0 18px;
  letter-spacing: -0.02em;
}
.hero h1 .grad {
  background: linear-gradient(120deg, var(--primary), var(--accent));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero p.lead { font-size: 1.18rem; color: var(--muted); max-width: 34ch; }
.hero-actions { display: flex; gap: 14px; margin-top: 30px; flex-wrap: wrap; }
.hero-visual {
  border-radius: 20px; border: 1px solid var(--border);
  box-shadow: 0 40px 80px -40px rgba(0, 0, 0, 0.55);
  width: 100%;
}

/* ---- sections ---- */
.section { padding: 96px 0; }
.section-head { max-width: 40ch; margin-bottom: 48px; }
.section-head .eyebrow { margin-bottom: 16px; }
.section-head h2 { font-size: clamp(2rem, 3.6vw, 2.9rem); letter-spacing: -0.02em; }
.section-head p { color: var(--muted); margin-top: 14px; font-size: 1.05rem; }

.features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 18px; padding: 30px;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.card:hover { transform: translateY(-6px); border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
.card .dot {
  width: 44px; height: 44px; border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: var(--on-primary); font-weight: 700; font-family: var(--font-heading);
  margin-bottom: 18px;
}
.card h3 { font-size: 1.25rem; margin-bottom: 10px; }
.card p { color: var(--muted); font-size: 0.98rem; }

/* ---- showcase ---- */
.showcase .frame {
  border-radius: 22px; overflow: hidden; border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 50px 90px -50px rgba(0, 0, 0, 0.6);
}

/* ---- cta ---- */
.cta .panel {
  position: relative; overflow: hidden;
  border-radius: 26px; padding: 72px 40px; text-align: center;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--primary) 26%, var(--surface)),
    color-mix(in srgb, var(--accent) 26%, var(--surface)));
  border: 1px solid var(--border);
}
.cta h2 { font-size: clamp(2rem, 3.8vw, 3rem); letter-spacing: -0.02em; }
.cta p { color: var(--muted); margin: 14px auto 28px; max-width: 46ch; }

/* ---- footer ---- */
.footer { border-top: 1px solid var(--border); padding: 36px 0; }
.footer .wrap {
  display: flex; justify-content: space-between; align-items: center;
  gap: 16px; flex-wrap: wrap; color: var(--muted); font-size: 14px;
}

/* ---- reveal animation ---- */
/* Hidden only when JS is available, so the page is fully readable without it. */
.js .reveal {
  opacity: 0; transform: translateY(var(--reveal-y));
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
  transition-delay: var(--d, 0ms);
}
.js .reveal.is-visible { opacity: 1; transform: none; }

@media (max-width: 880px) {
  .hero .wrap { grid-template-columns: 1fr; gap: 36px; }
  .hero { padding: 56px 0 64px; }
  .section { padding: 64px 0; }
  .features { grid-template-columns: 1fr; }
  .nav-links a:not(.btn) { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .js .reveal { opacity: 1; transform: none; transition: none; }
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
`;
}

function renderJs() {
  return `// Progressive enhancement only — the page is fully readable without JS.
(function () {
  var nav = document.getElementById('nav');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  reveals.forEach(function (el) { io.observe(el); });
})();
`;
}

function navLinks(model) {
  return model.nav
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('\n          ');
}

function featureCards(model) {
  return model.copy.features
    .map(
      (f, i) => `<article class="card reveal" style="--d:${i * 90}ms">
            <div class="dot">${esc(String(i + 1))}</div>
            <h3>${esc(f.title)}</h3>
            <p>${esc(f.body)}</p>
          </article>`,
    )
    .join('\n          ');
}

export function renderSite(model) {
  const css = renderCss(model);
  const js = renderJs();
  const fontsUrl = googleFontsUrl(model.typography.googleFonts);
  const { copy, assets, brand } = model;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(model.meta.title)}</title>
  <meta name="description" content="${esc(model.meta.description)}">
  <meta name="theme-color" content="${esc(model.palette.primary)}">
  <meta name="generator" content="webgen">
  <script>document.documentElement.classList.add('js');</script>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(model.meta.title)}">
  <meta property="og:description" content="${esc(model.meta.description)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="assets/logo.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${esc(fontsUrl)}">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="nav" id="nav">
    <div class="wrap">
      <a class="brand" href="#main">
        <img src="assets/logo.svg" alt="" width="34" height="34">
        <span>${esc(brand.name)}</span>
      </a>
      <nav class="nav-links">
          ${navLinks(model)}
        <a class="btn btn-primary" href="${esc(copy.primaryCta.href)}">${esc(copy.primaryCta.label)}</a>
      </nav>
    </div>
  </header>

  <main id="main">
    <section class="hero">
      <div class="wrap">
        <div class="hero-copy">
          <span class="eyebrow reveal">${esc(copy.eyebrow)}</span>
          <h1 class="reveal" style="--d:80ms">${esc(copy.headlinePre)} <span class="grad">${esc(copy.headlineEmphasis)}</span></h1>
          <p class="lead reveal" style="--d:160ms">${esc(copy.subhead)}</p>
          <div class="hero-actions reveal" style="--d:240ms">
            <a class="btn btn-primary" href="${esc(copy.primaryCta.href)}">${esc(copy.primaryCta.label)}</a>
            <a class="btn btn-ghost" href="${esc(copy.secondaryCta.href)}">${esc(copy.secondaryCta.label)}</a>
          </div>
        </div>
        <div class="hero-art reveal" style="--d:200ms">
          <img class="hero-visual" src="${esc(assets.hero)}" alt="${esc(brand.name)} hero visual" width="1600" height="1000">
        </div>
      </div>
    </section>

    <section class="section features-section" id="features">
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">${esc(copy.featuresEyebrow)}</span>
          <h2>${esc(copy.featuresTitle)}</h2>
          <p>${esc(copy.featuresIntro)}</p>
        </div>
        <div class="features">
          ${featureCards(model)}
        </div>
      </div>
    </section>

    <section class="section showcase" id="showcase">
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">${esc(copy.showcase.eyebrow)}</span>
          <h2>${esc(copy.showcase.title)}</h2>
          <p>${esc(copy.showcase.body)}</p>
        </div>
        <div class="frame reveal" style="--d:120ms">
          <img src="${esc(assets.transition)}" alt="Animated transition motion sequence" width="1600" height="500">
        </div>
      </div>
    </section>

    <section class="section cta" id="start">
      <div class="wrap">
        <div class="panel reveal">
          <h2>${esc(copy.closing.title)}</h2>
          <p>${esc(copy.closing.body)}</p>
          <a class="btn btn-primary" href="${esc(copy.closing.cta.href)}">${esc(copy.closing.cta.label)}</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="wrap">
      <span>© ${esc(model.year)} ${esc(brand.name)}. All rights reserved.</span>
      <span>${esc(model.directionName)} · built with webgen</span>
    </div>
  </footer>

  <script src="main.js" defer></script>
</body>
</html>
`;
  return { html, css, js };
}
