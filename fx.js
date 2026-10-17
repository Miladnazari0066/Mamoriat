'use strict';
/* ============================================================
   MissionLog 2027 — FX Layer (لایهٔ حرکت)
   باید بعد از script.js لود شود
   ============================================================ */
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const faNum = v => String(v).replace(/\d/g, d => FA[+d]);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- اسپلش شروع ---------- */
  function splash() {
    if (reduced) return;
    const el = document.createElement('div');
    el.className = 'fx-splash';
    el.innerHTML = `<div class="fx-splash-mark"><svg class="ic"><use href="#i-log"/></svg></div>
      <b>مأموریت‌نگار ۲۰۲۷</b><span class="fx-splash-bar"><i></i></span>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 550); }, 650);
  }

  /* ---------- Ripple روی دکمه‌ها ---------- */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn,.navbtn,.segbtn,.day:not(.blank),.chip .cx');
    if (!b || reduced) return;
    const r = b.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2.1;
    const s = document.createElement('span');
    s.className = 'fx-ripple';
    s.style.width = s.style.height = d + 'px';
    s.style.left = (e.clientX - r.left - d / 2) + 'px';
    s.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  });

  /* ---------- حذف کلاس انیمیشن پس از پایان (برای آزادشدن hover) ---------- */
  document.addEventListener('animationend', e => {
    const t = e.target;
    if (t instanceof Element && t.classList.contains('fx-in')) {
      t.classList.remove('fx-in');
      t.style.removeProperty('--i');
    }
  }, true);

  /* ---------- شمارندهٔ متحرک آمار ---------- */
  function countUp(el) {
    if (el.dataset.fxRun === '1') return;
    const raw = el.textContent.trim();
    if (raw === el.dataset.fxLast) return;
    const num = parseInt(raw.replace(/[۰-۹]/g, d => String(FA.indexOf(d))).replace(/[^\d-]/g, ''), 10);
    if (!isFinite(num) || num === 0) { el.dataset.fxLast = raw; return; }
    el.dataset.fxRun = '1'; el.dataset.fxLast = raw;
    const t0 = performance.now(), dur = 620;
    (function tick(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = faNum(Math.round(num * e));
      if (p < 1) requestAnimationFrame(tick);
      else { el.textContent = raw; el.dataset.fxRun = ''; }
    })(t0);
  }

  /* ---------- ورود پلکانی آیتم‌ها ---------- */
  function stagger(container, sel) {
    if (!container) return;
    $$(sel, container).forEach((el, i) => {
      if (el.dataset.fxDone) return;
      el.dataset.fxDone = '1';
      el.classList.add('fx-in');
      el.style.setProperty('--i', Math.min(i, 14));
    });
  }

  /* ---------- متحرک‌سازی نمودارهای میله‌ای ---------- */
  function animateBars() {
    $$('.drow .bb i, .rpt-bar-row .bb i').forEach(bar => {
      if (bar.dataset.fxDone || bar.closest('#pdfStage')) return;
      bar.dataset.fxDone = '1';
      const w = bar.style.width || '0%';
      bar.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = w; }));
    });
  }

  /* ---------- پایش تغییرات DOM (رندرهای مجدد برنامه) ---------- */
  function scan() {
    pending = false;
    $$('.stat-n').forEach(countUp);
    stagger($('#destSummary'), '.drow');
    stagger($('#recentList'), '.rrow');
    stagger($('#mList'), '.mcard');
    stagger($('#rptPrev'), '.drow, .pv-table tbody tr, .pv-sum .chip');
    animateBars();
  }
  let pending = false;
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(() => setTimeout(scan, 30)); } };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();

  /* ---------- نشانگر کشویی نوار پایین ---------- */
  function navInk() {
    const nav = $('#navBar');
    if (!nav) return;
    let ink = $('.fx-ink', nav);
    if (!ink) { ink = document.createElement('span'); ink.className = 'fx-ink'; nav.appendChild(ink); }
    const a = $('.navbtn.active', nav);
    if (a) {
      ink.style.width = a.offsetWidth + 'px';
      ink.style.transform = `translateX(${a.offsetLeft}px)`;
      ink.style.opacity = '1';
    } else ink.style.opacity = '0';
  }
  addEventListener('resize', navInk);
  addEventListener('load', navInk);
  const navBar = $('#navBar');
  if (navBar) new MutationObserver(() => requestAnimationFrame(navInk))
    .observe(navBar, { attributes: true, attributeFilter: ['class'], subtree: true });
  setTimeout(navInk, 120);

  splash();
})();