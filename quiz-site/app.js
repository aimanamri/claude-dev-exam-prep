// CCDV-F exam portal. No build step, no dependencies.
// Logic (loading, attempts, timer, grading, storage) is unchanged from v1; the UI layer below is
// a distraction-free exam-delivery design: dashboard → briefing → exam → score report.
(function () {
  "use strict";

  const LS = { attempt: "ccdvf.attempt.v1", history: "ccdvf.history.v1", prefs: "ccdvf.prefs.v1" };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const MODULE_NAMES = {
    M1: "Foundations", M2: "Prompting, Agents & Tool Use", M3: "Claude Code, MCP & Integration",
    M4: "Production Engineering, Evals & Security", M5: "Accelerators & IP Contribution",
  };
  const FONT_STEPS = [0.875, 1, 1.125, 1.25, 1.375];

  const $app = document.getElementById("app");
  let DATA = { config: {}, sets: [], byKey: {}, q: {}, errors: [] };
  let attempt = store.get(LS.attempt, null);
  let prefs = Object.assign({
    mode: "exam", shuffleQ: false, shuffleO: false,
    theme: null, fontStep: 1, timerHidden: false, split: false, splitPct: 50,
    candidate: "", candidateId: "",
  }, store.get(LS.prefs, {}));
  if (!prefs.candidateId) { prefs.candidateId = "CCD-" + String(Math.floor(100000 + Math.random() * 900000)); savePrefs(); }
  if (!prefs.theme) prefs.theme = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  let view = "home";            // home | brief | exam | results
  let briefKey = null;          // set key, or "__random"
  let resultRec = null;
  let resultFilter = "all";
  let navFilter = "all";
  let drawerOpen = false;
  let modal = null;             // { type: help | syscheck | name | confirm, ... }
  let pendingConfirm = null;
  let hlMode = false;
  let ticker = null, lastSave = 0, notice = "";

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function inline(s) {
    const codes = [];
    s = String(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = esc(s)
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
      .replace(/\u0000(\d+)\u0000/g, (m, i) => "<code>" + esc(codes[i]) + "</code>");
    return s;
  }
  function md(text) {
    const lines = String(text || "").split("\n");
    let out = "", para = [], list = null, i = 0;
    const flushP = () => { if (para.length) { out += "<p>" + para.map(inline).join("<br>") + "</p>"; para = []; } };
    const flushL = () => { if (list) { out += "<ul>" + list.map((x) => "<li>" + inline(x) + "</li>").join("") + "</ul>"; list = null; } };
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {
        flushP(); flushL(); const buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; out += "<pre><code>" + esc(buf.join("\n")) + "</code></pre>"; continue;
      }
      const li = l.match(/^\s*[-*]\s+(.*)$/);
      if (li) { flushP(); (list = list || []).push(li[1]); i++; continue; }
      if (l.trim() === "") { flushP(); flushL(); i++; continue; }
      flushL(); para.push(l.replace(/^>\s?/, "")); i++;
    }
    flushP(); flushL();
    return out;
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const LETTERS = "ABCDEF";
  function fmtTime(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }
  const fmtDate = (ts) => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const history = () => store.get(LS.history, []);
  const persist = () => { if (attempt) { store.set(LS.attempt, attempt); lastSave = Date.now(); } };
  function savePrefs() { store.set(LS.prefs, prefs); }
  function setHash(h) { try { window.history.replaceState(null, "", h || window.location.pathname + window.location.search); } catch (e) { /* file:// etc. */ } }
  const answeredCount = () => attempt.qkeys.filter((k) => (attempt.answers[k] || []).length).length;
  const passPct = () => DATA.config.passPercent || 80;
  const candidateName = () => prefs.candidate || "Candidate";
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "C";
  const examCode = (s) => "CCDVF-" + (s.code || s.prefix);

  const ICON = {
    logo: `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="12" fill="#007FA3"/><circle cx="32" cy="35" r="17" fill="none" stroke="#fff" stroke-width="5"/><path d="M32 35V25" stroke="#FFB81C" stroke-width="5" stroke-linecap="round"/><rect x="26" y="8" width="12" height="6" rx="2" fill="#fff"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>`,
    flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    contrast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/></svg>`,
    hl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 11l-5 5v4h4l5-5M14 6l4 4-6 6-4-4z"/></svg>`,
    split: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`,
    next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/></svg>`,
  };

  function applyPrefs() {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.style.fontSize = (FONT_STEPS[prefs.fontStep] || 1) * 100 + "%";
  }

  // Render with focus preserved by element id (keeps keyboard users in place across re-renders).
  function paint(html, focusId) {
    const active = document.activeElement && document.activeElement.id;
    $app.innerHTML = html;
    document.body.classList.toggle("in-exam", view === "exam");
    const target = focusId || (modal && "modal-first") || active;
    if (target) { const el = document.getElementById(target); if (el) el.focus({ preventScroll: !focusId }); }
  }

  let DATA_SOURCE = "api/sets";
  // ---------- loading ----------
  async function load() {
    // Live markdown from server.py when running locally; prebuilt sets.json on static hosting (GitHub Pages).
    let j = null;
    for (const url of ["api/sets", "sets.json"]) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        j = await r.json();
        DATA_SOURCE = url;
        break;
      } catch (e) { /* try the next source */ }
    }
    if (!j) {
      $app.innerHTML = `<main class="brief"><div class="brief-card"><div class="brief-head"><h1>Can't load the question sets</h1></div>
        <div class="brief-body"><p>Run the local server from the <code>quiz-site</code> folder, then reload:</p><pre><code>python3 server.py --open</code></pre></div></div></main>`;
      return;
    }
    const sets = [];
    (j.files || []).forEach((f) => { try { sets.push(...QuizParser.parseFile(f)); } catch (e) { (j.errors = j.errors || []).push(`${f.file}: ${e.message}`); } });
    const q = {}, byKey = {};
    sets.forEach((s) => { byKey[s.key] = s; s.questions.forEach((qq) => { q[s.key + "::" + qq.id] = Object.assign({ setKey: s.key, setTitle: s.title }, qq); }); });
    DATA = { config: j.config || {}, sets, byKey, q, errors: j.errors || [] };
    if (attempt) {
      attempt.qkeys = attempt.qkeys.filter((k) => DATA.q[k]); // drop questions removed since
      if (!attempt.qkeys.length) { attempt = null; store.del(LS.attempt); }
      else { if (attempt.status === "running") attempt.status = "paused"; attempt.current = Math.min(attempt.current, attempt.qkeys.length - 1); persist(); view = "exam"; }
    }
    if (window.location.hash === "#disclaimer" && view !== "exam") view = "disclaimer";
    render();
  }

  // ---------- attempts (unchanged logic) ----------
  function startAttempt(opts) {
    const forceShuffle = opts.forceShuffle;
    const qkeys = opts.qkeys.slice();
    const shuffleQ = forceShuffle || (opts.shuffleQ ?? prefs.shuffleQ);
    const shuffleO = forceShuffle || (opts.shuffleO ?? prefs.shuffleO);
    if (shuffleQ) shuffle(qkeys);
    const optOrder = {};
    qkeys.forEach((k) => {
      const letters = DATA.q[k].options.map((o) => o.letter);
      optOrder[k] = shuffleO ? shuffle(letters) : letters;
    });
    const ms = Math.max(1, opts.minutes) * 60000;
    attempt = {
      id: Date.now(), title: opts.title, code: opts.code || "", setKey: opts.setKey || null, kind: opts.kind || "set",
      qkeys, optOrder, answers: {}, flags: {}, struck: {}, checked: {}, highlights: {},
      mode: opts.mode || prefs.mode, shuffleQ, shuffleO, forceShuffle: !!forceShuffle,
      durationMs: ms, remainingMs: ms, current: 0, status: "running", startedAt: Date.now(),
    };
    persist();
    view = "exam"; drawerOpen = false; hlMode = false;
    startTicker();
    render("q-main");
  }
  function startSet(key, extra) {
    const s = DATA.byKey[key];
    if (!s || !s.questions.length) return;
    const minutes = s.minutes || Math.ceil((s.questions.length * (DATA.config.defaultSecondsPerQuestion || 75)) / 60);
    startAttempt(Object.assign({
      title: s.title, code: examCode(s), setKey: key, kind: "set", minutes,
      qkeys: s.questions.map((qq) => key + "::" + qq.id),
      forceShuffle: s.shuffle === "always" || s.shuffle === true,
    }, extra || {}));
  }
  function randomSpec() {
    const rm = DATA.config.randomMock || { questions: 40, minutes: 60 };
    const n = Math.min(rm.questions, Object.keys(DATA.q).length);
    return { n, minutes: Math.round((rm.minutes * n) / rm.questions) };
  }
  function startRandom() {
    const { n, minutes } = randomSpec();
    const all = shuffle(Object.keys(DATA.q));
    startAttempt({ title: `Random mock · ${n} Q from all sets`, code: "CCDVF-RND", kind: "random", qkeys: all.slice(0, n),
      minutes, shuffleO: prefs.shuffleO, shuffleQ: false });
  }
  function startTicker() {
    stopTicker();
    attempt.status = "running";
    attempt._resumedAt = Date.now();
    attempt._base = attempt.remainingMs;
    ticker = setInterval(tick, 250);
  }
  function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }
  function tick() {
    if (!attempt || attempt.status !== "running") return;
    attempt.remainingMs = attempt._base - (Date.now() - attempt._resumedAt);
    if (attempt.remainingMs <= 0) { attempt.remainingMs = 0; finish(true); return; }
    // Time warnings: announce to screen readers and force the timer visible.
    for (const mins of [5, 1]) {
      const key = "_warned" + mins;
      if (attempt.remainingMs <= mins * 60000 && !attempt[key] && attempt.durationMs > mins * 60000) {
        attempt[key] = true;
        announce(`${mins} minute${mins > 1 ? "s" : ""} remaining.`);
        if (prefs.timerHidden) { prefs.timerHidden = false; savePrefs(); if (view === "exam") render(); }
      }
    }
    const t = document.getElementById("timer-val");
    if (t) {
      t.textContent = fmtTime(attempt.remainingMs);
      const box = document.getElementById("timer-box");
      if (box) box.classList.toggle("warn", attempt.remainingMs < 5 * 60000);
    }
    if (Date.now() - lastSave > 2000) persist();
  }
  function announce(msg) { const el = document.getElementById("live"); if (el) { el.textContent = ""; setTimeout(() => (el.textContent = msg), 50); } }
  function pause() { if (!attempt || attempt.status !== "running") return; tick(); stopTicker(); attempt.status = "paused"; drawerOpen = false; persist(); render("btn-resume"); }
  function resume() { if (!attempt) return; view = "exam"; startTicker(); persist(); render("q-main"); }

  function grade(a) {
    const perQ = a.qkeys.map((k) => {
      const q = DATA.q[k];
      const chosen = a.answers[k] || [];
      return { k, chosen, correct: q ? sameSet(chosen, q.answer) : false, answered: chosen.length > 0 };
    });
    const modules = {}, core = { c: 0, t: 0 };
    perQ.forEach((r) => {
      const q = DATA.q[r.k]; if (!q) return;
      const m = (modules[q.module] = modules[q.module] || { c: 0, t: 0 });
      m.t++; if (r.correct) m.c++;
      if (q.core) { core.t++; if (r.correct) core.c++; }
    });
    const correct = perQ.filter((r) => r.correct).length;
    return { correct, total: perQ.length, percent: Math.round((100 * correct) / perQ.length), perQ, modules, core };
  }
  function finish(timeUp) {
    if (!attempt) return;
    stopTicker();
    const result = grade(attempt);
    const rec = Object.assign({}, attempt, { finishedAt: Date.now(), timeUp: !!timeUp, result,
      snapshot: Object.fromEntries(attempt.qkeys.map((k) => [k, DATA.q[k]])) });
    delete rec._base; delete rec._resumedAt;
    const h = history(); h.unshift(rec); store.set(LS.history, h.slice(0, 40));
    attempt = null; store.del(LS.attempt);
    resultRec = rec; resultFilter = "all"; view = "results"; drawerOpen = false; modal = null;
    render("score-heading");
    window.scrollTo(0, 0);
  }
  function endExam() {
    const unanswered = attempt.qkeys.length - answeredCount();
    const flagged = attempt.qkeys.filter((k) => attempt.flags[k]).length;
    let body = "<p>Your answers will be marked and you can't return to the questions.</p>";
    if (unanswered) body = `<p><b>${unanswered} question${unanswered > 1 ? "s are" : " is"} unanswered</b>${flagged ? ` and ${flagged} flagged for review` : ""}. Unanswered questions score zero.</p>` + body;
    else if (flagged) body = `<p>All questions are answered. <b>${flagged} still flagged</b> for review.</p>` + body;
    confirmBox({ title: "Submit exam?", body, ok: "Submit exam", danger: !!unanswered, cancel: unanswered ? "Return to exam" : "Cancel" }, () => finish(false));
  }
  function confirmBox(opts, fn) { modal = Object.assign({ type: "confirm" }, opts); pendingConfirm = fn; render(); }

  // ---------- shared chrome ----------
  function systemChecks() {
    let storageOk = false;
    try { localStorage.setItem("ccdvf.__t", "1"); storageOk = localStorage.getItem("ccdvf.__t") === "1"; localStorage.removeItem("ccdvf.__t"); } catch (e) { /* blocked */ }
    const totalQ = Object.keys(DATA.q).length;
    return [
      { ok: totalQ > 0, label: "Question bank", detail: `${totalQ} questions in ${DATA.sets.length} exams loaded from ${DATA_SOURCE === "sets.json" ? "the hosted bundle" : "the local server (live markdown)"}.` },
      { ok: storageOk, label: "Progress storage", detail: storageOk ? "Browser storage works: progress, pauses and scores are saved on this device." : "Browser storage is blocked (private window?). Exams still run, but progress won't be saved." },
      { ok: true, label: "Exam timer", detail: "Uses your device clock. Pausing stops it; closing the tab pauses the exam." },
      { ok: !DATA.errors.length, label: "Content check", detail: DATA.errors.length ? `${DATA.errors.length} source error(s): see the notice on the dashboard.` : "All sources parsed without errors." },
      { ok: window.innerWidth >= 768, warnOnly: true, label: "Screen size", detail: `${window.innerWidth}px wide. ${window.innerWidth >= 1024 ? "Split view available." : window.innerWidth >= 768 ? "Fine; split view needs 900px+." : "Works on phones; a larger screen is recommended."}` },
    ];
  }
  function sysReady() { return systemChecks().every((c) => c.ok || c.warnOnly); }

  function ubar(extra) {
    const ready = sysReady();
    return `<header class="ubar"><div class="ubar-inner">
      <a class="brand" href="#" data-action="home" aria-label="CCDV-F Exam Portal, dashboard">${ICON.logo}<span><b>CCDV-F</b> Exam Portal</span></a>
      <div class="ubar-right">
        ${extra || ""}
        <button class="sys-pill ${ready ? "" : "warn"}" id="btn-sys" data-action="syscheck" aria-haspopup="dialog"><span class="dot" aria-hidden="true"></span><span class="lbl">${ready ? "System ready" : "Check system"}</span><span class="sr-only">${ready ? "" : "Some checks need attention"}: open system check</span></button>
        <button class="icon-btn" id="btn-theme" data-action="toggle-theme" aria-pressed="${prefs.theme === "dark"}" aria-label="High-contrast dark mode" title="High-contrast dark mode">${ICON.contrast}</button>
        <button class="icon-btn" id="btn-help" data-action="help" aria-haspopup="dialog" aria-label="Help and keyboard shortcuts" title="Help">${ICON.help}</button>
        <button class="cand" id="btn-cand" data-action="name" aria-haspopup="dialog" aria-label="Candidate ${esc(candidateName())}, ID ${esc(prefs.candidateId)}. Edit name">
          <span class="avatar" aria-hidden="true">${esc(initials(candidateName()))}</span><span><b>${esc(candidateName())}</b><small>ID ${esc(prefs.candidateId)}</small></span></button>
      </div></div></header>`;
  }

  function modalHtml() {
    if (!modal) return "";
    let title = "", body = "", foot = "", wide = false;
    if (modal.type === "help") {
      wide = true; title = "Help";
      body = `<h3>How it works</h3>
        <ul><li>Pick an exam on the dashboard, review the briefing and delivery settings, then begin.</li>
        <li><b>Exam mode</b> shows answers and reasoning only after you submit. <b>Practice mode</b> lets you check each answer as you go. Both are timed and marked.</li>
        <li>Use <b>Flag for review</b> and the <b>Navigator</b> to come back to questions. Unanswered questions score zero.</li>
        <li>Pausing stops the timer and hides the question. Progress is saved in this browser, so you can close the tab and resume.</li></ul>
        <h3>Keyboard shortcuts (during an exam)</h3>
        <table class="kbd-table"><tbody>
        <tr><td><kbd>A</kbd>–<kbd>E</kbd> or <kbd>1</kbd>–<kbd>5</kbd></td><td>Select an answer</td></tr>
        <tr><td><kbd>↑</kbd> <kbd>↓</kbd></td><td>Move between answers (when an answer has focus)</td></tr>
        <tr><td><kbd>Space</kbd></td><td>Select / deselect the focused answer</td></tr>
        <tr><td><kbd>→</kbd> / <kbd>←</kbd></td><td>Next / previous question</td></tr>
        <tr><td><kbd>F</kbd></td><td>Flag or unflag the question</td></tr>
        <tr><td><kbd>N</kbd></td><td>Open the question navigator</td></tr>
        <tr><td><kbd>P</kbd></td><td>Pause / resume</td></tr>
        <tr><td><kbd>Enter</kbd></td><td>Check answer (Practice mode)</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Close a panel or dialog</td></tr></tbody></table>
        <h3 style="margin-top:1rem">Accessibility tools</h3>
        <p>In the exam bar: <b>A−/A+</b> text size, <b>contrast</b> mode, <b>highlighter</b> (select text in the question to mark it), <b>split view</b> (question and answers side by side, drag or use arrow keys on the divider), and a timer you can hide. Each answer has a strike-out button.</p>
        <h3>Adding exams</h3>
        <p class="small">Save a markdown set into <code>quiz-site/sets/</code> (format in <code>quiz-site/FORMAT.md</code>), then ${DATA_SOURCE === "sets.json" ? "push it to GitHub; this hosted copy rebuilds within a minute or two" : "use <b>Reload</b> on the dashboard"}.</p>
        <p class="small muted">Unofficial study tool. Not affiliated with, or endorsed by, Anthropic or Pearson. <a href="#disclaimer" data-action="disclaimer">Read the full disclaimer</a>.</p>`;
      foot = `<button class="btn primary" id="modal-first" data-action="close-modal">Close</button>`;
    } else if (modal.type === "syscheck") {
      title = "System check";
      body = `<ul class="checks">${systemChecks().map((c) => `<li><span class="ic ${c.ok ? "ok" : c.warnOnly ? "" : "bad"}" aria-hidden="true">${c.ok ? "✓" : c.warnOnly ? "!" : "✕"}</span><div><b>${esc(c.label)}</b><span class="sr-only">: ${c.ok ? "passed" : c.warnOnly ? "advisory" : "failed"}</span><div class="small muted">${esc(c.detail)}</div></div></li>`).join("")}</ul>`;
      foot = `<button class="btn primary" id="modal-first" data-action="close-modal">Done</button>`;
    } else if (modal.type === "name") {
      title = "Candidate details";
      body = `<form id="name-form" class="field"><label for="modal-first">Display name</label>
        <input id="modal-first" name="name" type="text" maxlength="40" autocomplete="name" value="${esc(prefs.candidate)}" placeholder="Candidate">
        <span class="small muted">Shown on your dashboard and score reports. Stored only in this browser. Candidate ID: ${esc(prefs.candidateId)}</span></form>`;
      foot = `<button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" type="submit" form="name-form">Save</button>`;
    } else if (modal.type === "confirm") {
      title = esc(modal.title); body = modal.body;
      foot = `<button class="btn" id="modal-first" data-action="close-modal">${esc(modal.cancel || "Cancel")}</button>
        <button class="btn ${modal.danger ? "danger solid" : "primary"}" data-action="confirm-ok">${esc(modal.ok || "OK")}</button>`;
    }
    return `<div class="modal-wrap" data-action="modal-backdrop"><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head"><h2 id="modal-title">${title}</h2><button class="btn ghost small" data-action="close-modal" aria-label="Close dialog">✕</button></div>
      <div class="modal-body">${body}</div><div class="modal-foot">${foot}</div></div></div>`;
  }

  // ---------- rendering ----------
  function render(focusId) {
    applyPrefs();
    if (view === "exam" && attempt) return renderExam(focusId);
    if (view === "brief" && briefKey) return renderBrief(focusId);
    if (view === "results" && resultRec) return renderResults(focusId);
    if (view === "disclaimer") return renderDisclaimer(focusId);
    view = "home"; renderHome(focusId);
  }

  // ----- Disclaimer (also reachable at #disclaimer) -----
  function renderDisclaimer(focusId) {
    paint(`<a class="skip" href="#main">Skip to content</a>${ubar()}
      <main class="brief" id="main" tabindex="-1">
        <p><a href="#" data-action="home" class="small">← Back to exams</a></p>
        <article class="brief-card" aria-labelledby="disc-h">
          <div class="brief-head"><span class="code">LEGAL</span><h1 id="disc-h" tabindex="-1">Disclaimer</h1>
            <p class="muted" style="margin:0">Please read before relying on this site for exam preparation.</p></div>
          <div class="brief-body prose">
            <section aria-labelledby="d1"><h2 id="d1">Unofficial study tool</h2>
              <p>This is an independent, community-made practice tool for the Claude Certified Developer – Foundations (CCDV-F) certification.
              It is <b>not affiliated with, endorsed by, sponsored by, or connected to Anthropic, PBC, Pearson, Pearson VUE, or any certification or testing body</b>.
              It is not an official exam, practice test, or exam simulator, and it does not use or reproduce real exam questions.</p></section>
            <section aria-labelledby="d2"><h2 id="d2">Trademarks</h2>
              <p>Claude, Anthropic, Fable, Opus, Sonnet and Haiku are trademarks of Anthropic, PBC. Pearson and Pearson VUE are trademarks of Pearson plc or its affiliates.
              Other names belong to their respective owners. They are used here only to describe what the material relates to, and no endorsement is implied.
              The visual style is a generic, distraction-free exam layout and does not represent any vendor's product.</p></section>
            <section aria-labelledby="d3"><h2 id="d3">Accuracy of the content</h2>
              <p>Questions, answers and reasoning were written from personal study notes, with AI assistance, and may contain mistakes or go out of date.
              Model IDs, prices, limits, beta headers and product behavior change often. <b>Always check the official documentation</b> at
              <a href="https://platform.claude.com/docs" target="_blank" rel="noopener">platform.claude.com/docs<span class="sr-only"> (opens in a new tab)</span></a>
              and the official course before relying on any detail. The "target" percentage is a study benchmark, not an official passing score.</p></section>
            <section aria-labelledby="d4"><h2 id="d4">No guarantee of results</h2>
              <p>Scoring well here does not guarantee that you will pass any certification exam. The material is provided "as is", without warranty of any kind,
              and the author is not liable for any outcome of using it.</p></section>
            <section aria-labelledby="d5"><h2 id="d5">Your data</h2>
              <p>There are no accounts, and nothing you enter is sent to the author. Your name, progress, settings and scores are stored only in this browser's local storage;
              clearing site data or using another device starts fresh. The page loads the Plus Jakarta Sans font from Google Fonts, and when it is opened on GitHub Pages it is
              served by GitHub; those providers handle requests under their own privacy policies.</p></section>
            <section aria-labelledby="d6"><h2 id="d6">Corrections</h2>
              <p>Spotted an error? Open an issue or pull request on the
              <a href="https://github.com/aimanamri/claude-dev-exam-prep" target="_blank" rel="noopener">GitHub repository<span class="sr-only"> (opens in a new tab)</span></a>.</p></section>
          </div>
          <div class="brief-foot"><span class="small muted">Last updated ${new Date(2026, 10, 16).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</span>
            <button class="btn primary" data-action="home">Back to exams</button></div>
        </article>
      </main>${modalHtml()}`, focusId || "disc-h");
  }

  function setStats(key) {
    const h = history().filter((r) => r.setKey === key && r.kind === "set");
    if (!h.length) return null;
    return { n: h.length, best: Math.max(...h.map((r) => r.result.percent)), last: h[0].result.percent };
  }
  function moduleBars(mods) {
    return `<div class="mod-bars">${Object.keys(mods).sort().map((m) => {
      const v = mods[m], pct = v.t ? Math.round((100 * v.c) / v.t) : 0;
      return `<div class="mod-row"><div class="mod-name"><b>${m}</b> <span class="muted">${esc(MODULE_NAMES[m] || "")}</span></div>
        <div class="bar" role="img" aria-label="${m}: ${pct} percent"><div class="bar-fill ${pct >= passPct() ? "ok" : pct >= 60 ? "mid" : "bad"}" style="width:${pct}%"></div></div>
        <div class="mod-val">${v.c}/${v.t} · ${pct}%</div></div>`;
    }).join("")}</div>`;
  }

  // ----- Candidate dashboard -----
  function renderHome(focusId) {
    const pass = passPct();
    const totalQ = Object.keys(DATA.q).length;
    const h = history();
    const agg = {};
    h.forEach((r) => Object.entries(r.result.modules).forEach(([m, v]) => { const a = (agg[m] = agg[m] || { c: 0, t: 0 }); a.c += v.c; a.t += v.t; }));
    const best = h.length ? Math.max(...h.map((r) => r.result.percent)) : null;
    const mocks = DATA.sets.filter((s) => !s.file.startsWith("../"));
    const pack = DATA.sets.filter((s) => s.file.startsWith("../"));

    const card = (s) => {
      const st = setStats(s.key);
      const mods = {}; s.questions.forEach((q) => (mods[q.module] = (mods[q.module] || 0) + 1));
      const multi = s.questions.filter((q) => q.multi).length;
      const core = s.questions.filter((q) => q.core).length;
      const inProg = attempt && attempt.setKey === s.key;
      const status = inProg ? ["progress", "In progress"] : st ? ["done", "Completed"] : ["ready", "Ready"];
      const titleId = "t-" + s.key.replace(/[^a-z0-9]/gi, "-");
      return `<li><article class="exam-card ${inProg ? "is-progress" : ""}" aria-labelledby="${titleId}">
        <div class="card-top"><span class="code">${esc(examCode(s))}</span><span class="badge ${status[0]}">${status[1]}</span></div>
        <h3 id="${titleId}">${esc(s.title)}</h3>
        ${s.description ? `<p>${inline(s.description)}</p>` : ""}
        <dl class="facts"><div><dt>Duration</dt><dd>${s.minutes || "?"} min</dd></div><div><dt>Questions</dt><dd>${s.questions.length}</dd></div>
          <div><dt>Format</dt><dd>${s.shuffle ? "Shuffled" : multi ? `${multi} multi` : "Single"}${core ? ` · ${core} core` : ""}</dd></div></dl>
        <div class="chips" aria-label="Modules covered">${Object.keys(mods).sort().map((m) => `<span class="chip" title="${esc(MODULE_NAMES[m] || "")}">${m} · ${mods[m]}</span>`).join("")}</div>
        ${s.warnings.length ? `<details class="warn-box"><summary>${s.warnings.length} question(s) skipped</summary><ul>${s.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></details>` : ""}
        <div class="card-foot">
          <span class="muted">${st ? `Best <b class="${st.best >= pass ? "ok" : ""}">${st.best}%</b> · Last ${st.last}%` : "Not attempted"}</span>
          ${inProg ? `<button class="btn primary" id="go-${titleId}" data-action="resume">Resume exam</button>`
            : `<button class="btn primary" id="go-${titleId}" data-action="brief" data-key="${esc(s.key)}" ${attempt ? 'disabled aria-describedby="busy-note"' : ""}>Launch exam</button>`}
        </div></article></li>`;
    };
    const rs = randomSpec();
    const randomCard = `<li><article class="exam-card" aria-labelledby="t-random">
      <div class="card-top"><span class="code">CCDVF-RND</span><span class="badge ready">Ready</span></div>
      <h3 id="t-random">Random mock exam</h3><p>${rs.n} questions drawn at random from every set. A new paper each time.</p>
      <dl class="facts"><div><dt>Duration</dt><dd>${rs.minutes} min</dd></div><div><dt>Questions</dt><dd>${rs.n}</dd></div><div><dt>Format</dt><dd>Mixed</dd></div></dl>
      <div class="card-foot"><span class="muted">Pool of ${totalQ}</span><button class="btn primary" id="go-random" data-action="brief" data-key="__random" ${attempt || !totalQ ? 'disabled aria-describedby="busy-note"' : ""}>Launch exam</button></div></article></li>`;

    paint(`<a class="skip" href="#main">Skip to content</a>${ubar()}
      <main class="dash" id="main" tabindex="-1">
        <section class="welcome" aria-labelledby="welcome-h">
          <div><h1 id="welcome-h">Welcome, ${esc(candidateName())}</h1><p>${esc(DATA.config.examName || "")} · practice exam portal</p></div>
          <div class="stats">
            <div class="stat"><b>${DATA.sets.length + 1}</b><span>Exams</span></div>
            <div class="stat"><b>${totalQ}</b><span>Questions</span></div>
            <div class="stat"><b>${h.length}</b><span>Attempts</span></div>
            <div class="stat"><b>${best == null ? "—" : best + "%"}</b><span>Best score</span></div>
            <div class="stat"><b>${pass}%</b><span>Target</span></div>
          </div>
        </section>
        ${notice ? `<div class="notice info" role="status">${esc(notice)}</div>` : ""}
        ${DATA.errors.length ? `<div class="notice error" role="alert">${DATA.errors.map(esc).join("<br>")}</div>` : ""}
        ${attempt ? `<div class="notice resume" role="region" aria-label="Exam in progress"><div><b>Exam in progress:</b> ${esc(attempt.title)} · ${answeredCount()}/${attempt.qkeys.length} answered · ${fmtTime(attempt.remainingMs)} left (paused)
          <div class="small muted" id="busy-note">Finish or discard it to launch another exam.</div></div>
          <div class="row"><button class="btn primary" id="btn-resume-banner" data-action="resume">Resume exam</button><button class="btn" data-action="discard">Discard</button></div></div>` : ""}

        <section aria-labelledby="exams-h">
          <div class="sec-head"><div><h2 id="exams-h">Your exams</h2><p>Launch opens the exam briefing, where you choose Exam or Practice mode.</p></div>
            ${DATA_SOURCE === "sets.json" ? "" : `<button class="btn small" id="btn-reload" data-action="reload">Reload sets</button>`}</div>
          <h3 class="group-label">Mock exams &amp; drills</h3>
          <ul class="exam-grid">${mocks.map(card).join("")}${randomCard}</ul>
          ${pack.length ? `<h3 class="group-label">Study-pack practice sets</h3><ul class="exam-grid">${pack.map(card).join("")}</ul>` : ""}
        </section>

        ${h.length ? `<div class="two-col">
          <section class="panel" aria-labelledby="perf-h"><h2 id="perf-h">Module accuracy</h2>${moduleBars(agg)}</section>
          <section class="panel" aria-labelledby="hist-h"><h2 id="hist-h">Recent attempts</h2><div class="table-wrap"><table class="hist">
            <thead><tr><th scope="col">Date</th><th scope="col">Exam</th><th scope="col">Score</th><th scope="col">Time</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
            ${h.slice(0, 10).map((r, i) => `<tr><td>${fmtDate(r.finishedAt)}</td><td>${esc(r.title)} <span class="muted small">(${r.mode})</span></td>
              <td><b class="${r.result.percent >= pass ? "ok" : "bad"}">${r.result.percent}%</b> <span class="muted">${r.result.correct}/${r.result.total}</span></td>
              <td>${fmtTime(r.durationMs - r.remainingMs)}${r.timeUp ? ' <span title="Time ran out">⏰</span>' : ""}</td>
              <td><button class="btn small" id="rv-${i}" data-action="view-result" data-idx="${i}" aria-label="Review ${esc(r.title)}, ${fmtDate(r.finishedAt)}">Review</button></td></tr>`).join("")}
            </tbody></table></div>
            <div class="row end" style="margin-top:.75rem"><button class="btn small ghost" data-action="clear-history">Clear history</button></div></section>
        </div>` : ""}

        <footer class="dash-foot">Progress and scores are saved in this browser only. Unofficial study tool, not affiliated with or endorsed by Anthropic or Pearson.
          <div class="row" style="margin-top:.35rem"><a href="#disclaimer" data-action="disclaimer">Disclaimer</a><span aria-hidden="true">·</span>
          <button class="btn small ghost" data-action="help">Help &amp; keyboard shortcuts</button><span aria-hidden="true">·</span>
          <a href="https://github.com/aimanamri/claude-dev-exam-prep" target="_blank" rel="noopener">Source on GitHub<span class="sr-only"> (opens in a new tab)</span></a></div></footer>
      </main>${modalHtml()}`, focusId);
    notice = "";
  }

  // ----- Pre-exam briefing -----
  function renderBrief(focusId) {
    const isRandom = briefKey === "__random";
    const s = isRandom ? null : DATA.byKey[briefKey];
    if (!isRandom && !s) { view = "home"; return render(); }
    const rs = randomSpec();
    const n = isRandom ? rs.n : s.questions.length;
    const minutes = isRandom ? rs.minutes : s.minutes;
    const multi = isRandom ? null : s.questions.filter((q) => q.multi).length;
    const forced = !isRandom && (s.shuffle === "always" || s.shuffle === true);
    paint(`<a class="skip" href="#main">Skip to content</a>${ubar()}
      <main class="brief" id="main" tabindex="-1">
        <p><a href="#" data-action="home" class="small">← Back to exams</a></p>
        <div class="brief-card">
          <div class="brief-head"><span class="code">${isRandom ? "CCDVF-RND" : esc(examCode(s))}</span>
            <h1 id="brief-h" tabindex="-1">${isRandom ? "Random mock exam" : esc(s.title)}</h1>
            ${!isRandom && s.description ? `<p class="muted">${inline(s.description)}</p>` : isRandom ? `<p class="muted">${n} questions drawn at random from all ${DATA.sets.length} sets.</p>` : ""}
            <dl class="facts"><div><dt>Questions</dt><dd>${n}</dd></div><div><dt>Time limit</dt><dd>${minutes} min</dd></div>
              <div><dt>Item types</dt><dd>${multi == null ? "Mixed" : multi ? `Single + ${multi} multi` : "Single answer"}</dd></div><div><dt>Target</dt><dd>${passPct()}%</dd></div></dl>
          </div>
          <form class="brief-body" id="brief-form">
            <fieldset class="choice"><legend>Delivery mode</legend>
              <label class="choice-opt"><input type="radio" name="mode" value="exam" data-action="pref-mode" ${prefs.mode === "exam" ? "checked" : ""}><div><b>Exam mode</b><span>Answers and reasoning are shown only after you submit, like the real exam.</span></div></label>
              <label class="choice-opt"><input type="radio" name="mode" value="practice" data-action="pref-mode" ${prefs.mode === "practice" ? "checked" : ""}><div><b>Practice mode</b><span>Check each answer as you go and read the reasoning. Still timed and marked.</span></div></label>
            </fieldset>
            <fieldset class="choice"><legend>Question order</legend>
              ${isRandom ? `<p class="small muted">Random mocks are always drawn in random order.</p>` : `<label class="choice-opt"><input type="checkbox" data-action="pref-shuffleQ" ${prefs.shuffleQ || forced ? "checked" : ""} ${forced ? "disabled" : ""}><div><b>Shuffle questions</b><span>${forced ? "This drill is always shuffled." : "Present questions in a random order."}</span></div></label>`}
              <label class="choice-opt"><input type="checkbox" data-action="pref-shuffleO" ${prefs.shuffleO || forced ? "checked" : ""} ${forced ? "disabled" : ""}><div><b>Shuffle answer options</b><span>Reasoning still refers to the original letters, which are shown after marking.</span></div></label>
            </fieldset>
            <section aria-labelledby="rules-h"><h2 id="rules-h" style="margin-bottom:.5rem">Before you begin</h2>
              <ul class="rules">
                <li>The timer starts when you select <b>Begin exam</b>. When it reaches zero, the exam is submitted automatically.</li>
                <li>Unless a question says <b>Choose TWO</b>, select one answer. Multi-select items score only if every pick is right.</li>
                <li>Use <b>Flag for review</b> and the <b>Navigator</b> to revisit questions before you submit.</li>
                <li><b>Pause</b> stops the timer and hides the question. Progress is saved in this browser.</li>
                <li>Shortcuts: <kbd>A</kbd>–<kbd>E</kbd> select · <kbd>←</kbd>/<kbd>→</kbd> previous/next · <kbd>F</kbd> flag · <kbd>N</kbd> navigator · <kbd>P</kbd> pause.</li>
              </ul></section>
          </form>
          <div class="brief-foot"><div class="row"><button class="btn" data-action="home">Cancel</button>
            <span class="small muted">Unofficial practice material. <a href="#disclaimer" data-action="disclaimer">Disclaimer</a></span></div>
            <button class="btn primary lg" id="btn-begin" data-action="begin">Begin exam ${ICON.next}</button></div>
        </div>
      </main>${modalHtml()}`, focusId || "brief-h");
  }

  // ----- Exam delivery -----
  function renderExam(focusId) {
    const k = attempt.qkeys[attempt.current];
    const q = DATA.q[k];
    const n = attempt.qkeys.length;
    const chosen = attempt.answers[k] || [];
    const checked = attempt.mode === "practice" && attempt.checked[k];
    const order = attempt.optOrder[k] || q.options.map((o) => o.letter);
    const struck = attempt.struck[k] || [];
    const need = q.answer.length;
    const paused = attempt.status === "paused";
    const answered = answeredCount();
    const isLast = attempt.current === n - 1;
    const flagged = !!attempt.flags[k];
    const hls = (attempt.highlights || {})[k] || [];
    const warn = attempt.remainingMs < 5 * 60000;
    const sectionName = `${q.module} · ${MODULE_NAMES[q.module] || "Section"}`;
    const inputType = q.multi ? "checkbox" : "radio";

    const opts = order.map((L, i) => {
      const o = q.options.find((x) => x.letter === L);
      if (!o) return "";
      const sel = chosen.includes(L);
      let cls = sel ? " selected" : "";
      if (checked) cls += q.answer.includes(L) ? " correct" : sel ? " wrong" : "";
      if (struck.includes(L) && !sel) cls += " struck";
      const tag = checked ? (q.answer.includes(L) ? '<span class="tag ok">Correct</span>' : sel ? '<span class="tag bad">Your pick</span>' : "") : "";
      return `<div class="opt-row${cls}">
        <label class="opt" for="opt-${L}">
          <input type="${inputType}" id="opt-${L}" name="answer" value="${L}" data-letter="${L}" ${sel ? "checked" : ""} ${checked ? "disabled" : ""}>
          <span class="opt-key" aria-hidden="true">${LETTERS[i]}</span>
          <span class="opt-text"><span class="sr-only">Option ${LETTERS[i]}: </span>${inline(o.text)}${struck.includes(L) ? '<span class="sr-only"> (struck out)</span>' : ""}</span>
          ${tag || (checked && attempt.shuffleO ? `<span class="tag" title="Letter used in the reasoning">orig. ${L}</span>` : "")}
        </label>
        ${checked ? "" : `<button type="button" class="strike" id="strike-${L}" data-action="strike" data-letter="${L}" aria-pressed="${struck.includes(L)}" aria-label="Strike out option ${LETTERS[i]}" title="Strike out (visual only)">S</button>`}
      </div>`;
    }).join("");
    const disp = (L) => LETTERS[order.indexOf(L)] + (attempt.shuffleO ? ` (orig. ${L})` : "");
    const ok = checked && sameSet(chosen, q.answer);

    const counts = { all: n, unanswered: n - answered, flagged: attempt.qkeys.filter((kk) => attempt.flags[kk]).length };
    const navShown = attempt.qkeys.map((kk, i) => ({ kk, i })).filter(({ kk }) =>
      navFilter === "unanswered" ? !(attempt.answers[kk] || []).length : navFilter === "flagged" ? attempt.flags[kk] : true);
    const drawer = drawerOpen ? `<div class="backdrop" data-action="close-drawer"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-h">
        <div class="drawer-head"><h2 id="drawer-h">Question navigator</h2><button class="btn ghost small" id="drawer-close" data-action="close-drawer" aria-label="Close navigator">✕</button></div>
        <div class="drawer-body">
          <p class="small" style="margin:0">${answered} answered · <b class="${counts.unanswered ? "bad" : "ok"}">${counts.unanswered} unanswered</b> · ${counts.flagged} flagged</p>
          <div class="legend" aria-hidden="true"><span><i class="swatch answered"></i>Answered</span><span><i class="swatch"></i>Unanswered</span><span><i class="swatch flagged"></i>Flagged</span></div>
          <div class="seg" role="group" aria-label="Filter questions" style="margin-bottom:1rem">${["all", "unanswered", "flagged"].map((f) => `<button type="button" id="nf-${f}" data-action="nav-filter" data-val="${f}" aria-pressed="${navFilter === f}">${f[0].toUpperCase() + f.slice(1)} (${counts[f]})</button>`).join("")}</div>
          <ul class="nav-grid">${navShown.map(({ kk, i }) => {
            const a = (attempt.answers[kk] || []).length > 0, fl = !!attempt.flags[kk];
            return `<li><button type="button" class="cell ${a ? "answered" : ""} ${fl ? "flagged" : ""}" id="cell-${i}" data-action="goto" data-idx="${i}" ${i === attempt.current ? 'aria-current="true"' : ""}
              aria-label="Question ${i + 1}, ${a ? "answered" : "unanswered"}${fl ? ", flagged" : ""}">${i + 1}</button></li>`;
          }).join("") || '<li class="small muted">None.</li>'}</ul>
        </div>
        <div class="drawer-foot row" style="justify-content:space-between"><button class="btn" data-action="close-drawer">Back to question ${attempt.current + 1}</button>
          <button class="btn primary" data-action="end">Submit exam</button></div>
      </aside>` : "";

    const pausedModal = paused ? `<div class="modal-wrap"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pause-h" aria-describedby="pause-d">
        <div class="modal-head"><h2 id="pause-h">Exam paused</h2></div>
        <div class="modal-body"><p id="pause-d" class="muted">The timer is stopped and the question is hidden. Progress is saved in this browser.</p>
          <div class="pause-stats"><div><b>${fmtTime(attempt.remainingMs)}</b><span>Remaining</span></div><div><b>${answered}/${n}</b><span>Answered</span></div></div></div>
        <div class="modal-foot"><button class="btn" data-action="home">Exit to dashboard</button><button class="btn primary" id="btn-resume" data-action="resume">Resume exam</button></div></div></div>` : "";

    paint(`<div class="exam ${prefs.split ? "split" : ""}">
      <a class="skip" href="#q-main">Skip to question</a>
      <header class="xbar">
        <div class="xbar-left"><div class="x-title">${attempt.code ? esc(attempt.code) + " · " : ""}${esc(attempt.title)}</div><div class="x-section">${esc(sectionName)}${attempt.mode === "practice" ? " · Practice mode" : ""}</div></div>
        <div class="xbar-right">
          <div class="x-progress" aria-label="Question ${attempt.current + 1} of ${n}">Question <b>${attempt.current + 1}</b> of ${n}</div>
          <div class="x-timer ${warn ? "warn" : ""}" id="timer-box">
            ${ICON.clock}${prefs.timerHidden ? `<span class="t-val" aria-hidden="true">--:--</span><span class="sr-only">Timer hidden</span>`
              : `<span class="t-val" id="timer-val" role="timer" aria-label="Time remaining">${fmtTime(attempt.remainingMs)}</span>`}
            <button type="button" class="tbtn" id="tool-timer" data-action="toggle-timer" aria-pressed="${prefs.timerHidden}" aria-label="${prefs.timerHidden ? "Show" : "Hide"} timer" title="${prefs.timerHidden ? "Show" : "Hide"} timer">${ICON.eye}</button>
          </div>
          <div class="x-tools" role="toolbar" aria-label="Accessibility tools">
            <button type="button" class="tbtn" id="tool-fs-dn" data-action="font-dn" aria-label="Decrease text size" title="Smaller text" ${prefs.fontStep <= 0 ? "disabled" : ""}>A−</button>
            <button type="button" class="tbtn" id="tool-fs-up" data-action="font-up" aria-label="Increase text size" title="Larger text" ${prefs.fontStep >= FONT_STEPS.length - 1 ? "disabled" : ""}>A+</button>
            <button type="button" class="tbtn" id="tool-contrast" data-action="toggle-theme" aria-pressed="${prefs.theme === "dark"}" aria-label="High-contrast dark mode" title="High contrast">${ICON.contrast}</button>
            <button type="button" class="tbtn" id="tool-hl" data-action="toggle-hl" aria-pressed="${hlMode}" title="Highlighter: select text in the question">${ICON.hl}<span class="lbl">Highlight</span></button>
            <button type="button" class="tbtn" id="tool-split" data-action="toggle-split" aria-pressed="${prefs.split}" title="Split view: question beside answers">${ICON.split}<span class="lbl">Split</span></button>
          </div>
          <button type="button" class="tbtn solid" id="btn-pause" data-action="pause" aria-label="Pause exam">${ICON.pause}<span class="lbl">Pause</span></button>
        </div>
      </header>
      <div class="x-progressbar" role="progressbar" aria-label="Questions answered" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${answered}" aria-valuetext="${answered} of ${n} answered"><div style="width:${(100 * answered) / n}%"></div></div>

      <main class="x-main ${paused ? "hidden-content" : ""}" id="q-main" tabindex="-1" aria-labelledby="q-h">
        <div class="q-header">
          <h1 id="q-h">Question ${attempt.current + 1} <span class="q-of">of ${n}</span></h1>
          <span class="chip">${esc(q.module)}</span>${q.core ? '<span class="chip core" title="Repeated MUST-REMEMBER fact">Core</span>' : ""}
          <span class="code">${attempt.kind !== "set" ? esc(q.setTitle) + " · " : ""}${esc(q.id)}</span>
          <span class="spacer"></span>
          ${hls.length ? `<button type="button" class="btn ghost small" data-action="clear-hl">Clear highlights</button>` : ""}
          <button type="button" class="flag-toggle" id="btn-flag" data-action="flag" aria-pressed="${flagged}">${ICON.flag}${flagged ? "Flagged" : "Flag for review"}</button>
        </div>
        <div class="q-body" style="--split:${prefs.splitPct}%">
          <section class="pane pane-stem" aria-label="Question text">
            ${hlMode ? '<p class="hl-hint">Highlighter on: select words in the question to mark them.</p>' : ""}
            <div class="stem ${hlMode ? "hl-on" : ""}" id="q-stem">${md(q.stem)}</div>
          </section>
          <div class="divider" id="divider" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize question and answer panes" aria-valuemin="25" aria-valuemax="75" aria-valuenow="${prefs.splitPct}"></div>
          <section class="pane pane-answers" aria-label="Answers">
            <fieldset class="answers" aria-describedby="hint-msg">
              <legend>${q.multi ? `Select <b>${need}</b> answers.` : "Select <b>one</b> answer."}</legend>
              <span id="hint-msg" role="status" aria-live="polite"></span>
              <div class="opt-list">${opts}</div>
            </fieldset>
            ${attempt.mode === "practice" ? (checked
              ? `<div class="feedback ${ok ? "ok" : "bad"}" role="status"><div class="fb-head">${ok ? "✓ Correct" : "✗ Incorrect"} · Answer: ${q.answer.map(disp).join(", ")}</div>${q.reasoning ? `<div class="reasoning">${md(q.reasoning)}</div>` : ""}</div>`
              : `<div class="check-row"><button type="button" class="btn primary" id="btn-check" data-action="check" ${chosen.length === need ? "" : "disabled"}>Check answer</button></div>`) : ""}
          </section>
        </div>
      </main>

      <nav class="x-nav" aria-label="Exam navigation">
        <button type="button" class="btn" id="btn-nav" data-action="drawer" aria-haspopup="dialog" aria-label="Question navigator, ${answered} of ${n} answered">${ICON.grid}<span class="lbl">Navigator</span><span class="count">${answered}/${n} answered</span></button>
        <div class="row">
          <button type="button" class="btn" id="btn-prev" data-action="prev" ${attempt.current === 0 ? "disabled" : ""}>${ICON.back}Previous</button>
          ${isLast ? `<button type="button" class="btn primary" id="btn-submit" data-action="end">Submit exam</button>`
            : `<button type="button" class="btn primary" id="btn-next" data-action="next">Next${ICON.next}</button>`}
        </div>
      </nav>
      <div id="live" class="sr-only" aria-live="assertive"></div>
      ${drawer}${pausedModal}${modalHtml()}</div>`, focusId || (drawerOpen && !document.querySelector(".drawer") ? "drawer-close" : null));

    applyHighlights(document.getElementById("q-stem"), hls);
  }

  // Wrap saved highlight strings (first match each) inside the stem's text nodes.
  function applyHighlights(root, list) {
    if (!root || !list.length) return;
    list.forEach((str) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement.closest("mark")) continue;
        const idx = node.nodeValue.indexOf(str);
        if (idx < 0) continue;
        const range = document.createRange();
        range.setStart(node, idx); range.setEnd(node, idx + str.length);
        const mark = document.createElement("mark"); mark.className = "hl";
        range.surroundContents(mark);
        break;
      }
    });
  }

  // ----- Score report -----
  function renderResults(focusId) {
    const r = resultRec, res = r.result, pass = passPct();
    const Q = (k) => (r.snapshot && r.snapshot[k]) || DATA.q[k];
    const items = res.perQ.map((p, i) => ({ p, i, q: Q(p.k), flagged: !!(r.flags || {})[p.k] })).filter((x) => x.q);
    const filters = {
      all: () => true, incorrect: (x) => !x.p.correct, correct: (x) => x.p.correct,
      unanswered: (x) => !x.p.answered, flagged: (x) => x.flagged, core: (x) => x.q.core,
    };
    const shown = items.filter(filters[resultFilter] || filters.all);
    const count = (f) => items.filter(filters[f]).length;
    const wrong = items.filter((x) => !x.p.correct);
    const used = r.durationMs - r.remainingMs;
    const passed = res.percent >= pass;
    paint(`<a class="skip" href="#main">Skip to content</a>${ubar()}
      <main class="results" id="main" tabindex="-1">
        <p><a href="#" data-action="home" class="small">← Back to exams</a></p>
        <section class="score-card" aria-labelledby="score-heading">
          <div class="score-band ${passed ? "pass" : "fail"}">${passed ? "At or above target" : "Below target"} (${pass}%)</div>
          <div class="score-main">
            <div><span class="code">${esc(r.code || "")}</span><h1 id="score-heading" tabindex="-1">Score report</h1><p class="muted" style="margin:.2rem 0 0">${esc(r.title)} · ${esc(candidateName())} · ${fmtDate(r.finishedAt)}</p></div>
            <div class="score-big ${passed ? "ok" : "bad"}" aria-label="Score ${res.percent} percent">${res.percent}%</div>
          </div>
          <div class="score-main" style="padding-top:0">
            <div class="stats">
              <div class="stat"><b>${res.correct}/${res.total}</b><span>Correct</span></div>
              <div class="stat"><b>${fmtTime(used)}</b><span>Time used${r.timeUp ? " (ran out)" : ""}</span></div>
              <div class="stat"><b>${r.mode === "practice" ? "Practice" : "Exam"}</b><span>Mode</span></div>
              ${res.core.t ? `<div class="stat"><b>${res.core.c}/${res.core.t}</b><span>Core items</span></div>` : ""}
            </div>
            <div class="row">
              ${r.kind === "set" && DATA.byKey[r.setKey] ? `<button class="btn primary" data-action="retake" data-shuffle="0">Retake</button><button class="btn" data-action="retake" data-shuffle="1">Retake shuffled</button>` : ""}
              ${wrong.length ? `<button class="btn" data-action="retake-wrong">Retry ${wrong.length} missed</button>` : ""}
            </div>
          </div>
        </section>
        <section class="panel" aria-labelledby="mod-h"><h2 id="mod-h">Performance by module</h2>${moduleBars(res.modules)}</section>
        <section class="panel" aria-labelledby="rev-h">
          <div class="review-head"><h2 id="rev-h">Answers &amp; reasoning</h2>
            <div class="seg" role="group" aria-label="Filter questions">${["all", "incorrect", "correct", "unanswered", "flagged", "core"].filter((f) => f === "all" || count(f)).map((f) => `<button type="button" id="rf-${f}" data-action="rfilter" data-val="${f}" aria-pressed="${resultFilter === f}">${f[0].toUpperCase() + f.slice(1)} (${count(f)})</button>`).join("")}</div></div>
          ${r.shuffleO ? '<p class="small muted">Options are listed in their original order so the letters match the reasoning.</p>' : ""}
          ${shown.map(({ p, i, q, flagged }) => `
            <article class="rev" aria-labelledby="rev-q-${i}">
              <div class="q-head"><h3 id="rev-q-${i}"><span class="${p.correct ? "mark-ok" : "mark-bad"}" aria-hidden="true">${p.correct ? "✓" : "✕"}</span> Question ${i + 1}<span class="sr-only">, ${p.correct ? "correct" : p.answered ? "incorrect" : "unanswered"}</span></h3>
                <span class="chip">${esc(q.module)}</span>${q.core ? '<span class="chip core">Core</span>' : ""}${flagged ? '<span class="chip flag">Flagged</span>' : ""}
                <span class="code">${esc(q.setTitle || "")} · ${esc(q.id)}</span></div>
              <div class="stem">${md(q.stem)}</div>
              <div class="opt-list">${q.options.map((o) => {
                const isA = q.answer.includes(o.letter), isC = p.chosen.includes(o.letter);
                return `<div class="opt-row ${isA ? "correct" : isC ? "wrong" : ""}"><div class="opt"><span class="opt-key">${o.letter}</span><span class="opt-text">${inline(o.text)}</span>${isC ? `<span class="tag ${isA ? "ok" : "bad"}">Your pick</span>` : ""}${isA ? '<span class="tag ok">Answer</span>' : ""}</div></div>`;
              }).join("")}</div>
              <p class="ans-line">Your answer: <b>${p.chosen.length ? p.chosen.slice().sort().join(", ") : "—"}</b> · Correct: <b>${q.answer.join(", ")}</b></p>
              ${q.reasoning ? `<div class="reasoning">${md(q.reasoning)}</div>` : ""}
            </article>`).join("") || '<p class="muted">Nothing in this filter.</p>'}
        </section>
      </main>${modalHtml()}`, focusId);
  }

  // ---------- interactions ----------
  function choose(L) {
    const k = attempt.qkeys[attempt.current], q = DATA.q[k];
    if (attempt.mode === "practice" && attempt.checked[k]) return false;
    let cur = (attempt.answers[k] || []).slice();
    if (q.multi) {
      if (cur.includes(L)) cur = cur.filter((x) => x !== L);
      else if (cur.length >= q.answer.length) {
        const m = document.getElementById("hint-msg");
        if (m) m.textContent = `You've already selected ${q.answer.length}. Deselect one first.`;
        return false;
      } else cur.push(L);
    } else cur = [L];
    attempt.answers[k] = cur;
    if (attempt.struck[k]) attempt.struck[k] = attempt.struck[k].filter((x) => x !== L);
    persist(); renderExam("opt-" + L);
    return true;
  }
  function go(i) {
    attempt.current = Math.max(0, Math.min(attempt.qkeys.length - 1, i));
    view = "exam"; drawerOpen = false; persist(); render("q-main"); window.scrollTo(0, 0);
  }
  function closeModal() {
    const back = modal && modal.returnFocus; modal = null; pendingConfirm = null; render(back);
  }
  function openModal(type, returnFocus) { modal = { type, returnFocus }; render(); }

  $app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a === "modal-backdrop") { if (e.target === el && modal) closeModal(); return; }
    if (el.tagName === "A") e.preventDefault();
    if (el.tagName === "INPUT") return; // handled by "change"
    const k = attempt && attempt.qkeys[attempt.current];
    switch (a) {
      case "home": setHash(""); stopTicker(); if (attempt && attempt.status === "running") { attempt.status = "paused"; persist(); } view = "home"; modal = null; drawerOpen = false; return render("main");
      case "brief": briefKey = el.dataset.key; view = "brief"; return render();
      case "disclaimer": modal = null; view = "disclaimer"; setHash("#disclaimer"); render(); return window.scrollTo(0, 0);
      case "begin": return briefKey === "__random" ? startRandom() : startSet(briefKey);
      case "reload": notice = "Sets reloaded from the markdown files."; return load();
      case "resume": return resume();
      case "discard": return confirmBox({ title: "Discard exam in progress?", body: "<p>Its answers and remaining time will be lost. This can't be undone.</p>", ok: "Discard exam", danger: true, returnFocus: "btn-resume-banner" }, () => { attempt = null; store.del(LS.attempt); modal = null; render("main"); });
      case "pause": return pause();
      case "help": return openModal("help", el.id);
      case "syscheck": return openModal("syscheck", el.id);
      case "name": return openModal("name", el.id);
      case "close-modal": return closeModal();
      case "confirm-ok": { const fn = pendingConfirm; modal = null; pendingConfirm = null; if (fn) fn(); else render(); return; }
      case "toggle-theme": prefs.theme = prefs.theme === "dark" ? "light" : "dark"; savePrefs(); return render(el.id);
      case "font-up": prefs.fontStep = Math.min(FONT_STEPS.length - 1, prefs.fontStep + 1); savePrefs(); return render(el.id);
      case "font-dn": prefs.fontStep = Math.max(0, prefs.fontStep - 1); savePrefs(); return render(el.id);
      case "toggle-timer": prefs.timerHidden = !prefs.timerHidden; savePrefs(); return render(el.id);
      case "toggle-hl": hlMode = !hlMode; return render(el.id);
      case "toggle-split": prefs.split = !prefs.split; savePrefs(); return render(el.id);
      case "clear-hl": attempt.highlights = attempt.highlights || {}; attempt.highlights[k] = []; persist(); return render("btn-flag");
      case "strike": {
        const s = new Set(attempt.struck[k] || []);
        s.has(el.dataset.letter) ? s.delete(el.dataset.letter) : s.add(el.dataset.letter);
        attempt.struck[k] = [...s]; persist(); return renderExam(el.id);
      }
      case "check": attempt.checked[k] = true; persist(); return renderExam("q-main");
      case "flag": attempt.flags[k] = !attempt.flags[k]; persist(); return renderExam("btn-flag");
      case "prev": return go(attempt.current - 1);
      case "next": return go(attempt.current + 1);
      case "drawer": drawerOpen = true; return render("drawer-close");
      case "close-drawer": drawerOpen = false; return render("btn-nav");
      case "nav-filter": navFilter = el.dataset.val; return render(el.id);
      case "goto": return go(parseInt(el.dataset.idx, 10));
      case "end": drawerOpen = false; return endExam();
      case "view-result": resultRec = history()[parseInt(el.dataset.idx, 10)]; resultFilter = "all"; view = "results"; render("score-heading"); return window.scrollTo(0, 0);
      case "rfilter": resultFilter = el.dataset.val; return render(el.id);
      case "retake": return startSet(resultRec.setKey, el.dataset.shuffle === "1" ? { shuffleQ: true, shuffleO: true, mode: resultRec.mode } : { shuffleQ: false, shuffleO: false, mode: resultRec.mode });
      case "retake-wrong": {
        const ks = resultRec.result.perQ.filter((p) => !p.correct && DATA.q[p.k]).map((p) => p.k);
        if (!ks.length) { notice = "Those questions are no longer in the loaded sets."; view = "home"; return render(); }
        const perQ = resultRec.durationMs / resultRec.qkeys.length;
        return startAttempt({ title: `Retry missed · ${resultRec.title}`, code: resultRec.code, kind: "retry", qkeys: ks,
          minutes: Math.max(1, Math.ceil((perQ * ks.length) / 60000)), mode: resultRec.mode, shuffleQ: true, shuffleO: true });
      }
      case "clear-history": return confirmBox({ title: "Clear attempt history?", body: "<p>All scores and reviews saved in this browser will be deleted. This can't be undone.</p>", ok: "Delete history", danger: true }, () => { store.del(LS.history); render("main"); });
    }
  });

  $app.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("input[data-letter]")) {
      if (!choose(t.dataset.letter)) t.checked = !t.checked; // multi-select limit reached
      return;
    }
    const a = t.dataset.action;
    if (a === "pref-mode") prefs.mode = t.value;
    else if (a === "pref-shuffleQ") prefs.shuffleQ = t.checked;
    else if (a === "pref-shuffleO") prefs.shuffleO = t.checked;
    else return;
    savePrefs();
  });

  $app.addEventListener("submit", (e) => {
    if (e.target.id === "name-form") {
      e.preventDefault();
      prefs.candidate = String(new FormData(e.target).get("name") || "").trim().slice(0, 40);
      savePrefs(); const back = modal && modal.returnFocus; modal = null; render(back);
    } else if (e.target.id === "brief-form") e.preventDefault();
  });

  // Highlighter: select text inside the question stem.
  $app.addEventListener("mouseup", () => {
    if (!hlMode || !attempt || view !== "exam") return;
    const sel = window.getSelection();
    const stem = document.getElementById("q-stem");
    if (!sel || sel.isCollapsed || !stem || !stem.contains(sel.anchorNode)) return;
    const str = sel.toString().replace(/\s+/g, " ").trim();
    if (str.length < 2) return;
    const k = attempt.qkeys[attempt.current];
    attempt.highlights = attempt.highlights || {};
    (attempt.highlights[k] = attempt.highlights[k] || []).push(str);
    sel.removeAllRanges(); persist(); renderExam("tool-hl");
  });

  // Split-pane divider: drag with pointer, or arrow keys when focused.
  let dragging = false;
  $app.addEventListener("pointerdown", (e) => {
    if (e.target.id !== "divider") return;
    dragging = true; e.target.setPointerCapture(e.pointerId); e.preventDefault();
  });
  $app.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const body = document.querySelector(".q-body"); if (!body) return;
    const r = body.getBoundingClientRect();
    prefs.splitPct = Math.round(Math.min(75, Math.max(25, ((e.clientX - r.left) / r.width) * 100)));
    body.style.setProperty("--split", prefs.splitPct + "%");
    document.getElementById("divider").setAttribute("aria-valuenow", prefs.splitPct);
  });
  $app.addEventListener("pointerup", () => { if (dragging) { dragging = false; savePrefs(); } });

  document.addEventListener("keydown", (e) => {
    const key = e.key, t = e.target;
    if (modal) {
      if (key === "Escape") { e.preventDefault(); closeModal(); }
      else if (key === "Tab") trapFocus(e, document.querySelector(".modal"));
      return;
    }
    if (!attempt || view !== "exam" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (attempt.status === "paused") {
      if (key === "p" || key === "P") { e.preventDefault(); resume(); }
      else if (key === "Tab") trapFocus(e, document.querySelector(".modal"));
      return;
    }
    if (drawerOpen) {
      if (key === "Escape") { e.preventDefault(); drawerOpen = false; render("btn-nav"); }
      else if (key === "Tab") trapFocus(e, document.querySelector(".drawer"));
      return;
    }
    if (t.id === "divider" && (key === "ArrowLeft" || key === "ArrowRight")) {
      e.preventDefault();
      prefs.splitPct = Math.min(75, Math.max(25, prefs.splitPct + (key === "ArrowLeft" ? -5 : 5)));
      savePrefs(); return render("divider");
    }
    if (t.matches && t.matches("input[type=text], textarea")) return;
    const onAnswer = t.matches && t.matches("input[data-letter]");
    if (key === "p" || key === "P") { e.preventDefault(); return pause(); }
    const k = attempt.qkeys[attempt.current];
    const order = attempt.optOrder[k];
    if (key === "f" || key === "F") { e.preventDefault(); attempt.flags[k] = !attempt.flags[k]; persist(); return renderExam("btn-flag"); }
    if (key === "n" || key === "N") { e.preventDefault(); drawerOpen = true; return render("drawer-close"); }
    let idx = key.length === 1 ? "ABCDE".indexOf(key.toUpperCase()) : -1;
    if (/^[1-6]$/.test(key)) idx = parseInt(key, 10) - 1;
    if (idx >= 0 && idx < order.length) { e.preventDefault(); return choose(order[idx]); }
    if (!onAnswer && key === "ArrowRight") { e.preventDefault(); return attempt.current < attempt.qkeys.length - 1 ? go(attempt.current + 1) : (drawerOpen = true, render("drawer-close")); }
    if (!onAnswer && key === "ArrowLeft") { e.preventDefault(); return go(attempt.current - 1); }
    if (onAnswer && (key === "ArrowDown" || key === "ArrowUp") && DATA.q[k].multi) {
      // checkboxes don't arrow-navigate natively; mirror radio behaviour
      e.preventDefault();
      const inputs = [...document.querySelectorAll("input[data-letter]")];
      const i = inputs.indexOf(t) + (key === "ArrowDown" ? 1 : -1);
      if (inputs[i]) inputs[i].focus();
      return;
    }
    if (key === "Enter" && !t.closest("button, a") && attempt.mode === "practice" && !attempt.checked[k] && (attempt.answers[k] || []).length === DATA.q[k].answer.length) {
      e.preventDefault(); attempt.checked[k] = true; persist(); return renderExam("q-main");
    }
  });
  function trapFocus(e, box) {
    if (!box) return;
    const f = [...box.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href], [tabindex='0']")];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener("visibilitychange", () => { if (attempt) { if (attempt.status === "running") tick(); persist(); } });
  window.addEventListener("beforeunload", () => { if (attempt) { if (attempt.status === "running") tick(); persist(); } });

  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#disclaimer" && view !== "exam" && DATA.sets.length) { modal = null; view = "disclaimer"; render(); window.scrollTo(0, 0); }
  });

  applyPrefs();
  load();
})();
