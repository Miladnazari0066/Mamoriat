'use strict';
/* ============================================================
   MissionLog 2027 — Application Core
   ============================================================ */

/* ---------- 1) Helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const PAD = n => String(n).padStart(2, '0');
const FA = '۰۱۲۳۴۵۶۷۸۹';
const faNum = v => String(v).replace(/\d/g, d => FA[+d]);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));
const nowIso = () => new Date().toISOString();
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toISO = d => `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
const fromISO = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd, 12, 0, 0); };
const todayISO = () => toISO(new Date());
const debounce = (f, t) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => f(...a), t); }; };
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('load failed: ' + src));
    document.head.appendChild(s);
  });
}

/* ---------- 2) Jalali (Shamsi) calendar engine — based on the standard jalaali-js algorithm ---------- */
function div(a, b) { return ~~(a / b); }
function mod(a, b) { return a - ~~(a / b) * b; }
function jalCal(jy, withoutLeap) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const bl = breaks.length, gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jm, jump, leap, n, i;
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalaali year ' + jy);
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
  }
  return { leap, gy, march };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function j2d(jy, jm, jd) {
  const r = jalCal(jy, true);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621, k, jm, jd;
  const r = jalCal(jy, false);
  const jdn1f = g2d(gy, 3, r.march);
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy, jm, jd }; }
    k -= 186;
  } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}
const isLeapJ = jy => jalCal(jy, false).leap === 0;
const jLen = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : (isLeapJ(jy) ? 30 : 29));

/* ---------- 3) Constants & date formatting ---------- */
const DESTS = ['گمرک گرمسار', 'گمرک سمنان', 'گرمسار', 'ایوانکی', 'سمنان'];
const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const WD = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه','شنبه']; // index = Date.getDay()
const wdOf = d => WD[d.getDay()];
const jOf = d => d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()));
const dOf = (jy, jm, jd) => { const g = d2g(j2d(jy, jm, jd)); return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0); };
const fmtJ = (jy, jm, jd) => `${faNum(jd)} ${MONTHS[jm - 1]} ${faNum(jy)}`;
const fmtISO = s => { const j = jOf(fromISO(s)); return fmtJ(j.jy, j.jm, j.jd); };
function weekWindow(iso) {
  const d = fromISO(iso);
  const sat = addDays(d, -((d.getDay() + 1) % 7)); // Saturday of this Jalali week
  const wed = addDays(sat, 4);                      // Wednesday (work week = Sat..Wed)
  return { from: toISO(sat), to: toISO(wed) };
}

/* ---------- 4) Store ---------- */
const LS_R = 'ml2027.records.v1', LS_S = 'ml2027.settings.v1';
let records = [];
let settings = { theme: null, supabase: null };
let sb = null, sbUser = null;
const state = {
  view: 'dashboard',
  flt: { q: '', from: '', to: '', dest: '', wd: '', month: '' },
  rpt: null
};

function loadLocal() {
  try { records = JSON.parse(localStorage.getItem(LS_R)) || []; }
  catch (e) { records = []; }
  try { settings = Object.assign({ theme: null, supabase: null }, JSON.parse(localStorage.getItem(LS_S)) || {}); }
  catch (e) { settings = { theme: null, supabase: null }; }
}
const saveLocal = () => localStorage.setItem(LS_R, JSON.stringify(records));
const saveSettings = () => localStorage.setItem(LS_S, JSON.stringify(settings));
function sortRecs() {
  records.sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
}
function upsertRecord(rec) {
  rec.updatedAt = nowIso();
  const i = records.findIndex(r => r.id === rec.id);
  if (i >= 0) records[i] = rec; else { rec.createdAt = rec.updatedAt; records.push(rec); }
  sortRecs(); saveLocal(); cloudUpsert(rec);
}
function removeRecord(id) {
  records = records.filter(r => r.id !== id);
  saveLocal(); cloudDelete(id);
}

/* ---------- 5) Statistics (always computed from real records) ---------- */
const recsBetween = (from, to) => records.filter(r => (!from || r.date >= from) && (!to || r.date <= to));
const countToday = () => records.filter(r => r.date === todayISO()).length;
const countWeek = () => { const w = weekWindow(todayISO()); return recsBetween(w.from, w.to).length; };
const countMonth = () => {
  const j = jOf(new Date());
  return records.filter(r => { const jj = jOf(fromISO(r.date)); return jj.jy === j.jy && jj.jm === j.jm; }).length;
};
function byDest(recs) {
  const m = new Map();
  for (const r of recs) m.set(r.dest, (m.get(r.dest) || 0) + 1);
  return DESTS.map(d => ({ dest: d, n: m.get(d) || 0 })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
}

/* ---------- 6) Toasts & busy overlay ---------- */
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<svg class="ic"><use href="#i-${type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info'}"/></svg><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 3600);
}
function busy(on, msg = '…') { $('#busy').hidden = !on; if (on) $('#busyMsg').textContent = msg; }

/* ---------- 7) Modal system ---------- */
function openModal(html, opts = {}) {
  const bd = document.createElement('div');
  bd.className = 'mb';
  bd.innerHTML = `<div class="mpanel" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(bd);
  requestAnimationFrame(() => bd.classList.add('show'));
  const close = () => {
    bd.classList.remove('show');
    setTimeout(() => bd.remove(), 190);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape' && opts.dismissable !== false) close(); };
  document.addEventListener('keydown', onKey);
  if (opts.dismissable !== false)
    bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
  if (opts.onOpen) opts.onOpen(bd, close);
  const f = bd.querySelector('[data-autofocus]') || bd.querySelector('button, input, select, textarea');
  if (f) setTimeout(() => f.focus(), 60);
  return { el: bd, close };
}
function showConfirm({ title, message, okLabel = 'حذف', danger = true }) {
  return new Promise(res => {
    openModal(`
      <div class="mhead"><h3>${esc(title)}</h3><button class="iconbtn mclose" aria-label="بستن"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <p class="mtext">${esc(message)}</p>
      <div class="mactions">
        <button class="btn ghost" data-no>انصراف</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes data-autofocus>${esc(okLabel)}</button>
      </div>`,
      { onOpen(el, close) {
          el.querySelector('[data-yes]').onclick = () => { close(); res(true); };
          el.querySelector('[data-no]').onclick  = () => { close(); res(false); };
          el.querySelector('.mclose').onclick    = () => { close(); res(false); };
        } });
  });
}

/* ---------- 8) Jalali date picker ---------- */
function openDatePicker(iso, onSelect) {
  let v = iso ? jOf(fromISO(iso)) : jOf(new Date());
  const m = openModal(`
    <div class="dp">
      <div class="mhead"><h3>انتخاب تاریخ</h3><button class="iconbtn dp-x" aria-label="بستن"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="dp-head">
        <div class="dp-nav">
          <button class="iconbtn" data-py title="سال قبل"><svg class="ic"><use href="#i-chevs-r"/></svg></button>
          <button class="iconbtn" data-pm title="ماه قبل"><svg class="ic"><use href="#i-chev-r"/></svg></button>
        </div>
        <div class="dp-title"><b class="dp-m"></b><span class="dp-y"></span></div>
        <div class="dp-nav">
          <button class="iconbtn" data-nm title="ماه بعد"><svg class="ic"><use href="#i-chev-l"/></svg></button>
          <button class="iconbtn" data-ny title="سال بعد"><svg class="ic"><use href="#i-chevs-l"/></svg></button>
        </div>
      </div>
      <div class="dp-grid"></div>
      <div class="dp-foot"><button class="btn ghost sm dp-today">امروز</button><span></span></div>
    </div>`,
    { onOpen(el, close) {
        const grid = $('.dp-grid', el);
        const tISO = todayISO();
        function render() {
          $('.dp-m', el).textContent = MONTHS[v.jm - 1];
          $('.dp-y', el).textContent = faNum(v.jy);
          const first = dOf(v.jy, v.jm, 1);
          const off = (first.getDay() + 1) % 7; // Saturday-first offset
          const len = jLen(v.jy, v.jm);
          let h = ['ش','ی','د','س','چ','پ','ج'].map(d => `<span class="dh">${d}</span>`).join('');
          for (let i = 0; i < off; i++) h += '<button class="day blank" tabindex="-1"></button>';
          for (let d = 1; d <= len; d++) {
            const diso = toISO(dOf(v.jy, v.jm, d));
            const cls = ['day'];
            if (diso === tISO) cls.push('today');
            if (iso && diso === iso) cls.push('sel');
            if (dOf(v.jy, v.jm, d).getDay() === 5) cls.push('fri');
            h += `<button class="${cls.join(' ')}" data-d="${d}">${faNum(d)}</button>`;
          }
          grid.innerHTML = h;
        }
        grid.addEventListener('click', e => {
          const b = e.target.closest('.day[data-d]');
          if (!b) return;
          const d = +b.dataset.d;
          close();
          onSelect(toISO(dOf(v.jy, v.jm, d)));
        });
        $('[data-pm]', el).onclick = () => { v.jm--; if (v.jm < 1) { v.jm = 12; v.jy--; } render(); };
        $('[data-nm]', el).onclick = () => { v.jm++; if (v.jm > 12) { v.jm = 1; v.jy++; } render(); };
        $('[data-py]', el).onclick = () => { v.jy--; render(); };
        $('[data-ny]', el).onclick = () => { v.jy++; render(); };
        $('.dp-today', el).onclick = () => { close(); onSelect(tISO); };
        $('.dp-x', el).onclick = () => close();
        render();
      } });
}

/* ---------- 9) Mission create / edit modal ---------- */
function openMissionModal(rec) {
  const isEdit = !!rec;
  let iso = isEdit ? rec.date : todayISO();
  const m = openModal(`
    <div class="mhead"><h3>${isEdit ? 'ویرایش مأموریت' : 'ثبت مأموریت جدید'}</h3><button class="iconbtn m-x" aria-label="بستن"><svg class="ic"><use href="#i-x"/></svg></button></div>
    <form id="mf" novalidate>
      <div class="fld"><span>تاریخ مأموریت</span>
        <div class="daterow">
          <button type="button" class="input dateinput" id="mfDate"><svg class="ic"><use href="#i-cal"/></svg><b id="mfDateTxt"></b></button>
          <button type="button" class="btn ghost sm" data-q="today">امروز</button>
          <button type="button" class="btn ghost sm" data-q="yest">دیروز</button>
        </div>
        <small class="hint" id="mfWeek"></small>
      </div>
      <label class="fld"><span>مقصد *</span>
        <select id="mfDest" class="input" data-autofocus>
          <option value="" ${isEdit ? '' : 'selected'} disabled>انتخاب مقصد…</option>
          ${DESTS.map(d => `<option value="${d}" ${isEdit && rec.dest === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </label>
      <label class="fld"><span>یادداشت <i class="opt">(اختیاری)</i></span>
        <textarea id="mfNotes" class="input" rows="3" maxlength="300" placeholder="مثلاً: پیگیری امور گمرکی، جلسه با انبار…">${isEdit ? esc(rec.notes) : ''}</textarea>
      </label>
      <div class="mactions">
        <button type="button" class="btn ghost m-x2">انصراف</button>
        <button type="submit" class="btn primary" id="mfSave">${isEdit ? 'ذخیره تغییرات' : 'ثبت مأموریت'}</button>
      </div>
    </form>`,
    { onOpen(el, close) {
        const paint = () => {
          $('#mfDateTxt', el).textContent = fmtISO(iso);
          $('#mfWeek', el).textContent = 'روز هفته: ' + wdOf(fromISO(iso));
        };
        $('#mfDate', el).onclick = () => openDatePicker(iso, v => { iso = v; paint(); });
        $$('[data-q]', el).forEach(b => b.onclick = () => {
          iso = b.dataset.q === 'today' ? todayISO() : toISO(addDays(new Date(), -1));
          paint();
        });
        $('.m-x', el).onclick = close;
        $('.m-x2', el).onclick = close;
        let saving = false;
        $('#mf', el).onsubmit = async e => {
          e.preventDefault();
          if (saving) return;                      // جلوگیری از ثبت تکراری
          const dest = $('#mfDest', el).value;
          if (!dest) { toast('لطفاً مقصد را انتخاب کنید', 'error'); return; }
          const notes = $('#mfNotes', el).value.trim();
          if (!isEdit) {
            const dup = records.find(r => r.date === iso && r.dest === dest && (r.notes || '').trim() === notes);
            if (dup) {
              const ok = await showConfirm({
                title: 'رکورد مشابه',
                message: 'برای این تاریخ و مقصد، رکورد یکسانی از قبل ثبت شده است. ادامه می‌دهید؟',
                okLabel: 'ثبت مجدد', danger: false
              });
              if (!ok) return;
            }
          }
          saving = true;
          $('#mfSave', el).classList.add('loading');
          upsertRecord({
            id: isEdit ? rec.id : uid(),
            date: iso, dest, notes,
            createdAt: isEdit ? rec.createdAt : nowIso(),
            updatedAt: nowIso()
          });
          close();
          toast(isEdit ? 'مأموریت ویرایش شد' : 'مأموریت با موفقیت ثبت شد');
          renderAll();
        };
        paint();
      } });
}

/* ---------- 10) Dashboard ---------- */
function renderDashboard() {
  const t = new Date();
  $('#dashHeroWd').textContent = wdOf(t);
  $('#dashHeroDate').textContent = fmtISO(todayISO());
  const n = countToday();
  const st = $('#dashStatus');
  if (n > 0) { st.className = 'chip ok'; st.textContent = `${faNum(n)} مأموریت امروز ثبت شده`; }
  else { st.className = 'chip warn'; st.textContent = 'برای امروز هنوز مأموریتی ثبت نشده'; }
  $('#statToday').textContent = faNum(n);
  $('#statWeek').textContent = faNum(countWeek());
  $('#statMonth').textContent = faNum(countMonth());

  const j = jOf(t);
  const monthRecs = records.filter(r => { const jj = jOf(fromISO(r.date)); return jj.jy === j.jy && jj.jm === j.jm; });
  const bd = byDest(monthRecs);
  $('#destSummary').innerHTML = bd.length ? bd.map(x => {
    const max = bd[0].n;
    return `<div class="drow"><span class="bn">${esc(x.dest)}</span><span class="bb"><i style="width:${Math.round(x.n / max * 100)}%"></i></span><span class="bv">${faNum(x.n)}</span></div>`;
  }).join('') : '<div class="empty-sm">در این ماه مأموریتی ثبت نشده است.</div>';

  const recent = records.slice(0, 6);
  $('#recentList').innerHTML = recent.length ? recent.map(r => {
    const d = fromISO(r.date);
    return `<div class="rrow">
      <span class="rdate"><b>${faNum(jOf(d).jd)}</b><span>${MONTHS[jOf(d).jm - 1].slice(0, 6)}</span></span>
      <span class="rinfo"><b>${esc(r.dest)}</b><span>${wdOf(d)}${r.notes ? ' · ' + esc(r.notes) : ''}</span></span>
    </div>`;
  }).join('') : '<div class="empty-sm">هنوز مأموریتی ثبت نشده است.</div>';
}

/* ---------- 11) Missions list & filters ---------- */
function applyFilters() {
  const f = state.flt;
  const q = f.q.trim().toLowerCase();
  return records.filter(r => {
    if (q && !(r.dest.toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q))) return false;
    if (f.dest && r.dest !== f.dest) return false;
    if (f.wd !== '' && f.wd !== null && fromISO(r.date).getDay() !== +f.wd) return false;
    if (f.month) { const [jy, jm] = f.month.split('-').map(Number); const jj = jOf(fromISO(r.date)); if (jj.jy !== jy || jj.jm !== jm) return false; }
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    return true;
  });
}
function monthsPresent() {
  const set = new Set(records.map(r => { const j = jOf(fromISO(r.date)); return `${j.jy}-${PAD(j.jm)}`; }));
  const j = jOf(new Date());
  set.add(`${j.jy}-${PAD(j.jm)}`);
  return Array.from(set).sort().reverse().map(s => {
    const [jy, jm] = s.split('-').map(Number);
    return { v: `${jy}-${jm}`, l: `${MONTHS[jm - 1]} ${faNum(jy)}` };
  });
}
function activeFilterChips() {
  const f = state.flt, out = [];
  if (f.q) out.push({ k: 'q', l: `جستجو: ${f.q}` });
  if (f.from) out.push({ k: 'from', l: `از: ${fmtISO(f.from)}` });
  if (f.to) out.push({ k: 'to', l: `تا: ${fmtISO(f.to)}` });
  if (f.dest) out.push({ k: 'dest', l: `مقصد: ${f.dest}` });
  if (f.wd !== '' && f.wd !== null) out.push({ k: 'wd', l: `روز: ${WD[+f.wd]}` });
  if (f.month) { const [jy, jm] = f.month.split('-').map(Number); out.push({ k: 'month', l: `ماه: ${MONTHS[jm - 1]} ${faNum(jy)}` }); }
  return out;
}
function renderMissions() {
  const chips = activeFilterChips();
  $('#mChips').innerHTML = chips.map(c =>
    `<span class="chip acc">${esc(c.l)}<button class="cx" data-chip="${c.k}" aria-label="حذف فیلتر"><svg class="ic" style="width:13px;height:13px"><use href="#i-x"/></svg></button></span>`).join('');

  const list = applyFilters();
  $('#mCount').textContent = list.length ? `${faNum(list.length)} مأموریت` : '';
  const box = $('#mList');

  if (!list.length) {
    const noData = records.length === 0;
    box.innerHTML = `<div class="card empty">
      <span class="eicon"><svg class="ic"><use href="#i-calx"/></svg></span>
      <b>${noData ? 'هنوز مأموریتی ثبت نشده' : 'موردی یافت نشد'}</b>
      <p>${noData ? 'اولین مأموریت کاری خود را ثبت کنید؛ ثبت فقط چند ثانیه طول می‌کشد.' : 'هیچ مأموریتی با فیلترهای انتخابی مطابقت ندارد.'}</p>
      ${noData ? '<button class="btn primary" id="emptyAdd"><svg class="ic"><use href="#i-plus"/></svg>ثبت مأموریت</button>'
               : '<button class="btn ghost" id="emptyClear">پاک‌کردن فیلترها</button>'}
    </div>`;
    const a = $('#emptyAdd'); if (a) a.onclick = () => openMissionModal(null);
    const c = $('#emptyClear'); if (c) c.onclick = clearFilters;
    return;
  }

  const counts = new Map();
  for (const r of list) counts.set(r.date, (counts.get(r.date) || 0) + 1);
  const yest = toISO(addDays(new Date(), -1));
  let html = '', last = null;
  for (const r of list) {
    if (r.date !== last) {
      if (last !== null) html += '</div>';
      const d = fromISO(r.date);
      const rel = r.date === todayISO() ? 'امروز' : r.date === yest ? 'دیروز' : fmtISO(r.date);
      html += `<div class="ghead ${r.date === todayISO() ? 'today' : ''}">
          <div><b>${rel}</b><span class="gwd">${wdOf(d)} · ${fmtISO(r.date)}</span></div>
          <span class="gcount">${faNum(counts.get(r.date))} مأموریت</span>
        </div><div class="gcards">`;
      last = r.date;
    }
    html += `<article class="mcard ${r.date === todayISO() ? 'istoday' : ''}" data-id="${r.id}">
      <span class="mtop"><span class="pin"><svg class="ic"><use href="#i-pin"/></svg></span><b>${esc(r.dest)}</b>${r.date === todayISO() ? '<span class="chip acc">امروز</span>' : ''}</span>
      ${r.notes ? `<p class="mnotes">${esc(r.notes)}</p>` : ''}
      <span class="macts">
        <button class="iconbtn" data-act="edit" aria-label="ویرایش"><svg class="ic"><use href="#i-edit"/></svg></button>
        <button class="iconbtn danger" data-act="del" aria-label="حذف"><svg class="ic"><use href="#i-trash"/></svg></button>
      </span>
    </article>`;
  }
  html += '</div>';
  box.innerHTML = html;
}
function clearFilters() {
  state.flt = { q: '', from: '', to: '', dest: '', wd: '', month: '' };
  $('#mSearch').value = '';
  renderMissions();
}
function openFilters() {
  const f = state.flt;
  const mo = monthsPresent();
  openModal(`
    <div class="mhead"><h3>فیلتر مأموریت‌ها</h3><button class="iconbtn f-x" aria-label="بستن"><svg class="ic"><use href="#i-x"/></svg></button></div>
    <div class="fld"><span>از تاریخ</span><button class="input dateinput" id="fltFrom"><svg class="ic"><use href="#i-cal"/></svg><b>${f.from ? fmtISO(f.from) : '— انتخاب —'}</b></button></div>
    <div class="fld"><span>تا تاریخ</span><button class="input dateinput" id="fltTo"><svg class="ic"><use href="#i-cal"/></svg><b>${f.to ? fmtISO(f.to) : '— انتخاب —'}</b></button></div>
    <label class="fld"><span>مقصد</span>
      <select id="fltDest" class="input"><option value="">همه مقاصد</option>${DESTS.map(d => `<option ${f.dest === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <label class="fld"><span>روز هفته</span>
      <select id="fltWd" class="input"><option value="">همه روزها</option>${WD.map((w, i) => `<option value="${i}" ${f.wd !== '' && f.wd !== null && +f.wd === i ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
    <label class="fld"><span>ماه</span>
      <select id="fltMonth" class="input"><option value="">همه ماه‌ها</option>${mo.map(o => `<option value="${o.v}" ${f.month === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label>
    <div class="mactions">
      <button class="btn ghost f-clear">پاک‌کردن</button>
      <button class="btn primary f-ok" data-autofocus>اعمال فیلتر</button>
    </div>`,
    { onOpen(el, close) {
        let from = f.from, to = f.to;
        const paint = () => {
          $('#fltFrom b', el).textContent = from ? fmtISO(from) : '— انتخاب —';
          $('#fltTo b', el).textContent = to ? fmtISO(to) : '— انتخاب —';
        };
        $('#fltFrom', el).onclick = () => openDatePicker(from, v => { from = v; paint(); });
        $('#fltTo', el).onclick = () => openDatePicker(to, v => { to = v; paint(); });
        $('.f-x', el).onclick = close;
        $('.f-clear', el).onclick = () => { close(); clearFilters(); toast('فیلترها پاک شد', 'info'); };
        $('.f-ok', el).onclick = () => {
          state.flt = {
            q: state.flt.q,
            from, to,
            dest: $('#fltDest', el).value,
            wd: $('#fltWd', el).value,
            month: $('#fltMonth', el).value
          };
          close(); renderMissions();
        };
      } });
}

/* ---------- 12) Reports ---------- */
function initRptState() {
  const j = jOf(new Date());
  state.rpt = {
    type: 'monthly',
    iso: todayISO(),
    jy: j.jy, jm: j.jm,
    from: toISO(dOf(j.jy, j.jm, 1)),
    to: todayISO()
  };
}
function computePeriod() {
  const r = state.rpt;
  if (r.type === 'daily')
    return { from: r.iso, to: r.iso, label: `روزانه — ${wdOf(fromISO(r.iso))} ${fmtISO(r.iso)}` };
  if (r.type === 'weekly') {
    const w = weekWindow(r.iso);
    return { from: w.from, to: w.to, label: `هفتگی — ${fmtISO(w.from)} تا ${fmtISO(w.to)} (شنبه تا چهارشنبه)` };
  }
  if (r.type === 'monthly') {
    const from = toISO(dOf(r.jy, r.jm, 1)), to = toISO(dOf(r.jy, r.jm, jLen(r.jy, r.jm)));
    return { from, to, label: `ماهانه — ${MONTHS[r.jm - 1]} ${faNum(r.jy)}` };
  }
  let { from, to } = r;
  if (from > to) { const t = from; from = to; to = t; }
  return { from, to, label: `بازه دلخواه — ${fmtISO(from)} تا ${fmtISO(to)}` };
}
function dateFieldHTML(label, id, iso) {
  return `<div class="fld"><span>${label}</span>
    <button class="input dateinput" id="${id}" data-iso="${iso}"><svg class="ic"><use href="#i-cal"/></svg><b>${iso ? fmtISO(iso) : '—'}</b></button></div>`;
}
function renderRptInputs() {
  const r = state.rpt, el = $('#rptInputs');
  if (r.type === 'monthly') {
    const minY = records.length ? Math.min(jOf(new Date()).jy, Math.min(...records.map(x => jOf(fromISO(x.date)).jy))) : jOf(new Date()).jy;
    const maxY = jOf(new Date()).jy;
    const years = []; for (let y = maxY; y >= minY; y--) years.push(y);
    el.innerHTML = `
      <label class="fld"><span>ماه</span>
        <select id="rM" class="input">${MONTHS.map((mn, i) => `<option value="${i + 1}" ${r.jm === i + 1 ? 'selected' : ''}>${mn}</option>`).join('')}</select></label>
      <label class="fld"><span>سال</span>
        <select id="rY" class="input">${years.map(y => `<option value="${y}" ${r.jy === y ? 'selected' : ''}>${faNum(y)}</option>`).join('')}</select></label>`;
    $('#rM', el).onchange = e => { r.jm = +e.target.value; renderReports(); };
    $('#rY', el).onchange = e => { r.jy = +e.target.value; renderReports(); };
  } else if (r.type === 'custom') {
    el.innerHTML = dateFieldHTML('از تاریخ', 'rFrom', r.from) + dateFieldHTML('تا تاریخ', 'rTo', r.to);
    $('#rFrom', el).onclick = () => openDatePicker(r.from, v => { r.from = v; renderReports(); });
    $('#rTo', el).onclick = () => openDatePicker(r.to, v => { r.to = v; renderReports(); });
  } else {
    const lbl = r.type === 'daily' ? 'روز گزارش' : 'هر روزی از هفتهٔ موردنظر';
    el.innerHTML = dateFieldHTML(lbl, 'rIso', r.iso) +
      (r.type === 'weekly' ? '<small class="hint">گزارش هفتهٔ کاریِ همان روز ساخته می‌شود (شنبه تا چهارشنبه).</small>' : '');
    $('#rIso', el).onclick = () => openDatePicker(r.iso, v => { r.iso = v; renderReports(); });
  }
}
function renderReports() {
  $$('#rptTypes .segbtn').forEach(b => b.classList.toggle('active', b.dataset.type === state.rpt.type));
  renderRptInputs();
  const period = computePeriod();
  const recs = recsBetween(period.from, period.to);
  const bd = byDest(recs);
  const days = new Set(recs.map(x => x.date)).size;
  const prev = $('#rptPrev');
  if (!recs.length) {
    prev.innerHTML = '<div class="empty-sm">در این بازهٔ زمانی مأموریتی ثبت نشده است.</div>';
    return;
  }
  prev.innerHTML = `
    <div class="pv-sum">
      <span class="chip acc">دوره: ${esc(period.label)}</span>
      <span class="chip">کل: ${faNum(recs.length)} مأموریت</span>
      <span class="chip">روزهای فعال: ${faNum(days)}</span>
    </div>
    ${bd.map(x => `<div class="drow"><span class="bn">${esc(x.dest)}</span><span class="bb"><i style="width:${Math.round(x.n / bd[0].n * 100)}%"></i></span><span class="bv">${faNum(x.n)}</span></div>`).join('')}
    <table class="pv-table" style="margin-top:12px">
      <thead><tr><th style="width:44px;text-align:center">ردیف</th><th style="width:120px">تاریخ</th><th style="width:82px">روز</th><th style="width:130px">مقصد</th><th>یادداشت</th></tr></thead>
      <tbody>${recs.slice(0, 8).map((x, i) => {
        const j = jOf(fromISO(x.date));
        return `<tr><td style="text-align:center">${faNum(i + 1)}</td><td>${fmtJ(j.jy, j.jm, j.jd)}</td><td>${wdOf(fromISO(x.date))}</td><td>${esc(x.dest)}</td><td>${esc(x.notes) || '—'}</td></tr>`;
      }).join('')}</tbody>
    </table>
    ${recs.length > 8 ? `<div class="pv-more">و ${faNum(recs.length - 8)} ردیف دیگر در فایل PDF…</div>` : ''}`;
}

/* ---------- 13) PDF engine (browser-rendered A4 pages → jsPDF) ---------- */
async function ensurePdfLibs() {
  if (window.html2canvas && window.jspdf) return;
  if (!window.html2canvas)
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!window.jspdf)
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
}
const THEAD_HTML = `<thead><tr><th class="c-rn">ردیف</th><th class="c-dt">تاریخ</th><th class="c-wd">روز</th><th class="c-ds">مقصد</th><th>یادداشت</th></tr></thead>`;
function buildPages(period, recs) {
  const W = 794, H = 1123;
  const stage = $('#pdfStage');
  stage.innerHTML = '';
  const pages = [];
  const genJ = jOf(new Date());
  const genLabel = fmtJ(genJ.jy, genJ.jm, genJ.jd);

  function newPage() {
    const page = document.createElement('div');
    page.className = 'rpt-page';
    page.innerHTML = `
      <div class="rpt-head"><span class="rpt-brand">مأموریت‌نگار ۲۰۲۷ — گزارش مأموریت‌های کاری</span><span>${esc(period.label)}</span></div>
      <div class="rpt-body"></div>
      <div class="rpt-foot"><span>تاریخ تهیه گزارش: ${genLabel}</span><span class="rpt-pn"></span></div>`;
    stage.appendChild(page);
    const body = $('.rpt-body', page);
    const head = $('.rpt-head', page);
    const limit = H - 34 - 60 - head.offsetHeight - 14;
    const p = { page, body, limit };
    pages.push(p);
    return p;
  }
  function newTable(p) {
    const t = document.createElement('table');
    t.className = 'rpt-table';
    t.innerHTML = THEAD_HTML + '<tbody></tbody>';
    p.body.appendChild(t);
    p.tbody = t.querySelector('tbody');
  }

  let cur = newPage();
  const tb = document.createElement('div');
  tb.className = 'rpt-titleblock';
  tb.innerHTML = `
    <div class="rpt-title">گزارش مأموریت‌های کاری</div>
    <div class="rpt-sub">${esc(period.label)}</div>
    <div class="rpt-meta">دوره گزارش: ${fmtISO(period.from)} تا ${fmtISO(period.to)} &nbsp;|&nbsp; تعداد کل مأموریت‌ها: <b>${faNum(recs.length)}</b></div>`;
  cur.body.appendChild(tb);

  const bd = byDest(recs);
  const days = new Set(recs.map(x => x.date)).size;
  const boxes = document.createElement('div');
  boxes.className = 'rpt-boxes';
  boxes.innerHTML = `
    <div class="rpt-box"><span class="n">${faNum(recs.length)}</span><span class="l">کل مأموریت‌ها</span></div>
    <div class="rpt-box"><span class="n">${faNum(days)}</span><span class="l">روزهای فعال</span></div>
    <div class="rpt-box"><span class="n">${faNum(bd.length)}</span><span class="l">تعداد مقاصد</span></div>`;
  cur.body.appendChild(boxes);

  if (bd.length) {
    const sum = document.createElement('div');
    sum.className = 'rpt-sum';
    sum.innerHTML = `<div class="rpt-sect">خلاصه بر اساس مقصد</div>` + bd.map(x =>
      `<div class="rpt-bar-row"><span class="bn">${esc(x.dest)}</span><span class="bb"><i style="width:${Math.round(x.n / bd[0].n * 100)}%"></i></span><span class="bv">${faNum(x.n)}</span></div>`).join('');
    cur.body.appendChild(sum);
  }

  const sect = document.createElement('div');
  sect.className = 'rpt-sect';
  sect.textContent = 'ریز مأموریت‌ها';
  cur.body.appendChild(sect);
  newTable(cur);

  let rn = 0;
  for (const r of recs) {
    const j = jOf(fromISO(r.date));
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="c-rn">${faNum(++rn)}</td><td class="c-dt">${fmtJ(j.jy, j.jm, j.jd)}</td><td class="c-wd">${wdOf(fromISO(r.date))}</td><td class="c-ds">${esc(r.dest)}</td><td class="c-nt">${esc(r.notes) || '—'}</td>`;
    cur.tbody.appendChild(tr);
    if (cur.body.scrollHeight > cur.limit) {   // صفحه‌بندی خودکار جدول
      tr.remove(); rn--;
      cur = newPage(); newTable(cur);
      cur.tbody.appendChild(tr); rn++;
    }
  }
  pages.forEach((p, i) => $('.rpt-pn', p.page).textContent = `صفحه ${faNum(i + 1)} از ${faNum(pages.length)}`);
  return pages;
}
async function exportPdf() {
  const period = computePeriod();
  const recs = recsBetween(period.from, period.to);
  if (!recs.length) { toast('در این بازه مأموریتی ثبت نشده است', 'error'); return; }
  busy(true, 'در حال ساخت PDF…');
  try {
    await ensurePdfLibs();
    await document.fonts.ready;
    const pages = buildPages(period, recs);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    for (let i = 0; i < pages.length; i++) {
      const cv = await html2canvas(pages[i].page, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      const img = cv.toDataURL('image/jpeg', 0.93);
      if (i) doc.addPage();
      doc.addImage(img, 'JPEG', 0, 0, 210, 297);
    }
    const j = jOf(fromISO(period.from));
    doc.save(`MissionLog-${j.jy}-${PAD(j.jm)}.pdf`);
    toast('گزارش PDF با موفقیت ساخته شد');
  } catch (err) {
    console.error(err);
    toast('ساخت PDF ناموفق بود؛ اتصال اینترنت را بررسی کنید', 'error');
  }
  busy(false);
}
function printReport() {
  const period = computePeriod();
  const recs = recsBetween(period.from, period.to);
  if (!recs.length) { toast('در این بازه مأموریتی ثبت نشده است', 'error'); return; }
  document.fonts.ready.then(() => { buildPages(period, recs); setTimeout(() => window.print(), 120); });
}

/* ---------- 14) Backup & restore ---------- */
function exportBackup() {
  const data = { app: 'missionlog2027', version: 1, exportedAt: nowIso(), records };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `missionlog-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('فایل پشتیبان دانلود شد');
}
function importBackup(file) {
  const fr = new FileReader();
  fr.onload = async () => {
    try {
      const data = JSON.parse(fr.result);
      if (!data || data.app !== 'missionlog2027' || !Array.isArray(data.records)) throw new Error('bad file');
      const ok = await showConfirm({
        title: 'بازیابی پشتیبان',
        message: `${faNum(data.records.length)} رکورد در فایل پشتیبان یافت شد. رکوردها با داده‌های فعلی ادغام می‌شوند (رکورد جدیدتر جایگزین می‌شود). ادامه می‌دهید؟`,
        okLabel: 'ادغام و بازیابی', danger: false
      });
      if (!ok) return;
      const map = new Map(records.map(r => [r.id, r]));
      for (const r of data.records) {
        if (!r.id || !r.date || !r.dest) continue;
        const old = map.get(r.id);
        if (!old || String(r.updatedAt || '') > String(old.updatedAt || '')) map.set(r.id, r);
      }
      records = Array.from(map.values());
      sortRecs(); saveLocal();
      toast('پشتیبان با موفقیت بازیابی شد');
      renderAll();
    } catch (e) {
      toast('فایل پشتیبان معتبر نیست', 'error');
    }
  };
  fr.readAsText(file);
}

/* ---------- 15) Optional Supabase cloud sync ---------- */
async function ensureSupaLib() {
  if (window.supabase) return;
  await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
}
async function cloudConnect() {
  const url = $('#sbUrl').value.trim(), key = $('#sbKey').value.trim();
  if (!url || !key) { toast('آدرس پروژه و کلید عمومی (anon key) را وارد کنید', 'error'); return; }
  busy(true, 'در حال اتصال…');
  try {
    await ensureSupaLib();
    sb = window.supabase.createClient(url, key);
    const { error } = await sb.auth.getSession();
    if (error) throw error;
    settings.supabase = { url, key };
    saveSettings();
    const { data } = await sb.auth.getUser();
    sbUser = data.user || null;
    if (sbUser) await cloudPull();
    toast('اتصال به Supabase برقرار شد');
  } catch (e) {
    sb = null; sbUser = null;
    toast('اتصال ناموفق بود: ' + (e.message || 'خطای ناشناخته'), 'error');
  }
  busy(false);
  renderSettingsCloud();
}
async function cloudSignIn(signup) {
  if (!sb) return;
  const email = $('#sbEmail').value.trim(), password = $('#sbPass').value;
  if (!email || !password) { toast('ایمیل و رمز عبور را وارد کنید', 'error'); return; }
  busy(true, signup ? 'در حال ثبت‌نام…' : 'در حال ورود…');
  try {
    const { error, data } = signup
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    sbUser = data.user || null;
    if (!sbUser && signup) toast('ثبت‌نام انجام شد؛ اگر تأیید ایمیل فعال است، ایمیل خود را تأیید کنید', 'info');
    else { await cloudPull(); toast('ورود موفق'); }
  } catch (e) { toast('خطا: ' + (e.message || ''), 'error'); }
  busy(false);
  renderSettingsCloud();
}
async function cloudSignOut() {
  if (!sb) return;
  await sb.auth.signOut();
  sbUser = null;
  toast('از حساب خارج شدید', 'info');
  renderSettingsCloud();
}
async function cloudPull() {
  if (!sb || !sbUser) return;
  const { data, error } = await sb.from('missions').select('*');
  if (error) { toast('دریافت داده از سرور ناموفق بود', 'error'); return; }
  const map = new Map(records.map(r => [r.id, r]));
  for (const row of data) {
    const rec = { id: row.id, date: row.mission_date, dest: row.destination, notes: row.notes || '', createdAt: row.created_at, updatedAt: row.updated_at };
    const old = map.get(rec.id);
    if (!old || String(rec.updatedAt) > String(old.updatedAt)) map.set(rec.id, rec);
  }
  records = Array.from(map.values());
  sortRecs(); saveLocal();
}
async function cloudUpsert(rec) {
  if (!sb || !sbUser) return;
  try {
    await sb.from('missions').upsert({
      id: rec.id, user_id: sbUser.id,
      mission_date: rec.date, destination: rec.dest, notes: rec.notes || '',
      created_at: rec.createdAt, updated_at: rec.updatedAt
    });
  } catch (e) { console.warn('cloud upsert failed', e); }
}
async function cloudDelete(id) {
  if (!sb || !sbUser) return;
  try { await sb.from('missions').delete().eq('id', id); }
  catch (e) { console.warn('cloud delete failed', e); }
}
async function cloudSyncNow() {
  if (!sb || !sbUser) { toast('ابتدا وارد حساب شوید', 'error'); return; }
  busy(true, 'همگام‌سازی…');
  try {
    for (const r of records) await cloudUpsert(r);
    await cloudPull();
    toast('همگام‌سازی کامل شد');
  } catch (e) { toast('همگام‌سازی ناموفق بود', 'error'); }
  busy(false);
  renderAll();
}

/* ---------- 16) Settings modal ---------- */
function renderSettingsCloud() {
  const box = $('#sbAuthBox');
  if (!box) return;
  if (!sb) {
    box.innerHTML = `<span class="chip">ذخیره‌سازی: محلی (مرورگر)</span><p class="hint" style="margin-top:8px">برای همگام‌سازی ابری، آدرس پروژه و کلید عمومی Supabase را وارد و «اتصال» را بزنید. کلید anon عمومی است و امنیت داده‌ها با RLS تضمین می‌شود.</p>`;
    return;
  }
  box.innerHTML = sbUser ? `
    <span class="chip ok">متصل — ${esc(sbUser.email || 'کاربر')}</span>
    <div class="mactions" style="margin-top:10px">
      <button class="btn ghost sm" id="sbSync"><svg class="ic"><use href="#i-sync"/></svg>همگام‌سازی</button>
      <button class="btn ghost sm" id="sbOut">خروج</button>
    </div>` : `
    <label class="fld" style="margin-top:10px"><span>ایمیل</span><input class="input" id="sbEmail" type="email" dir="ltr"></label>
    <label class="fld"><span>رمز عبور</span><input class="input" id="sbPass" type="password" dir="ltr"></label>
    <div class="mactions">
      <button class="btn primary sm" id="sbIn">ورود</button>
      <button class="btn ghost sm" id="sbUp">ثبت‌نام</button>
    </div>`;
  const s = $('#sbSync'); if (s) s.onclick = cloudSyncNow;
  const o = $('#sbOut'); if (o) o.onclick = cloudSignOut;
  const i = $('#sbIn'); if (i) i.onclick = () => cloudSignIn(false);
  const u = $('#sbUp'); if (u) u.onclick = () => cloudSignIn(true);
}
function openSettings() {
  openModal(`
    <div class="mhead"><h3>تنظیمات</h3><button class="iconbtn s-x" aria-label="بستن"><svg class="ic"><use href="#i-x"/></svg></button></div>
    <div class="panel-head" style="margin-top:4px"><h2>نمایش</h2></div>
    <button class="btn ghost sm" id="stTheme">تغییر پوسته روشن / تاریک</button>
    <div class="panel-head" style="margin-top:20px"><h2>پشتیبان‌گیری</h2></div>
    <div class="mactions" style="margin:0">
      <button class="btn ghost sm" id="stBackup"><svg class="ic"><use href="#i-down"/></svg>دریافت فایل پشتیبان</button>
      <button class="btn ghost sm" id="stRestore"><svg class="ic"><use href="#i-up"/></svg>بازیابی پشتیبان</button>
    </div>
    <input type="file" id="fileImport" accept=".json,application/json" hidden>
    <div class="panel-head" style="margin-top:20px"><h2>اتصال ابری (اختیاری)</h2></div>
    <div id="sbAuthBox"></div>
    <div id="sbCfg">
      <label class="fld" style="margin-top:10px"><span>Supabase URL</span><input class="input" id="sbUrl" dir="ltr" placeholder="https://xxxx.supabase.co"></label>
      <label class="fld"><span>Anon public key</span><input class="input" id="sbKey" dir="ltr" placeholder="eyJ…"></label>
      <button class="btn primary sm" id="sbConnect">اتصال</button>
    </div>
    <div class="panel-head" style="margin-top:22px"><h2>منطقه خطر</h2></div>
    <button class="btn danger sm" id="stWipe"><svg class="ic"><use href="#i-trash"/></svg>حذف تمام داده‌ها</button>`,
    { onOpen(el, close) {
        $('.s-x', el).onclick = close;
        $('#stTheme', el).onclick = () => { toggleTheme(); };
        $('#stBackup', el).onclick = exportBackup;
        $('#stRestore', el).onclick = () => $('#fileImport', el).click();
        $('#fileImport', el).onchange = e => { if (e.target.files[0]) importBackup(e.target.files[0]); };
        $('#sbConnect', el).onclick = cloudConnect;
        $('#stWipe', el).onclick = async () => {
          const ok = await showConfirm({ title: 'حذف همه داده‌ها', message: 'تمام مأموریت‌های ثبت‌شده برای همیشه حذف می‌شوند. مطمئن هستید؟' });
          if (!ok) return;
          records = []; saveLocal();
          if (sb && sbUser) { try { await sb.from('missions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (e) {} }
          toast('همه داده‌ها حذف شد', 'info');
          close(); renderAll();
        };
        if (settings.supabase) { $('#sbUrl', el).value = settings.supabase.url || ''; $('#sbKey', el).value = settings.supabase.key || ''; }
        renderSettingsCloud();
        const sync = $('#sbSync', el); if (sync) sync.onclick = cloudSyncNow;
      } });
}

/* ---------- 17) Theme ---------- */
function applyTheme() {
  const dark = settings.theme ? settings.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#btnTheme').innerHTML = `<svg class="ic"><use href="#i-${dark ? 'sun' : 'moon'}"/></svg>`;
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme === 'dark';
  settings.theme = cur ? 'light' : 'dark';
  saveSettings();
  applyTheme();
}

/* ---------- 18) Router ---------- */
const VIEWS = ['dashboard', 'missions', 'reports'];
function route() {
  const h = (location.hash || '#/').replace('#/', '');
  const v = VIEWS.includes(h) ? h : 'dashboard';
  state.view = v;
  VIEWS.forEach(x => { $('#view-' + x).hidden = x !== v; });
  $$('#navBar .navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  window.scrollTo({ top: 0 });
  if (v === 'dashboard') renderDashboard();
  if (v === 'missions') renderMissions();
  if (v === 'reports') renderReports();
}
function renderAll() {
  renderDashboard();
  renderMissions();
  if (state.view === 'reports') renderReports();
}

/* ---------- 19) Init ---------- */
function init() {
  loadLocal();
  sortRecs();
  initRptState();
  applyTheme();

  $('#btnTheme').onclick = toggleTheme;
  $('#btnSettings').onclick = openSettings;
  $('#fabAdd').onclick = () => openMissionModal(null);
  $('#btnHeroAdd').onclick = () => openMissionModal(null);
  $('#btnHeroReports').onclick = () => { location.hash = '#/reports'; };
  $('#recentAll').onclick = () => { location.hash = '#/missions'; };
  $('#mSearch').addEventListener('input', debounce(e => { state.flt.q = e.target.value; renderMissions(); }, 200));
  $('#mFilterBtn').onclick = openFilters;
  $('#mChips').addEventListener('click', e => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    state.flt[b.dataset.chip] = b.dataset.chip === 'wd' ? '' : '';
    if (b.dataset.chip === 'wd') state.flt.wd = '';
    renderMissions();
  });
  $('#mList').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('[data-id]');
    const rec = records.find(r => r.id === card.dataset.id);
    if (!rec) return;
    if (b.dataset.act === 'edit') openMissionModal(rec);
    else {
      const ok = await showConfirm({ title: 'حذف مأموریت', message: `مأموریت «${rec.dest}» در تاریخ ${fmtISO(rec.date)} حذف شود؟ این عمل قابل بازگشت نیست.` });
      if (!ok) return;
      removeRecord(rec.id);
      toast('مأموریت حذف شد', 'info');
      renderAll();
    }
  });
  $$('#rptTypes .segbtn').forEach(b => b.onclick = () => { state.rpt.type = b.dataset.type; renderReports(); });
  $('#btnPdf').onclick = exportPdf;
  $('#btnPrint').onclick = printReport;
  $$('#navBar .navbtn').forEach(b => b.onclick = () => { location.hash = '#/' + b.dataset.view; });
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', e => {
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openMissionModal(null); }
  });
  route();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();