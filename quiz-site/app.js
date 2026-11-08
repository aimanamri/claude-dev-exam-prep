// CCDV-F practice exam console. No build step, no dependencies.
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
    M4: "Production Eng., Evals & Security", M5: "Accelerators & IP Contribution",
  };

  const $app = document.getElementById("app");
  let DATA = { config: {}, sets: [], byKey: {}, q: {}, errors: [] };
  let attempt = store.get(LS.attempt, null);
  let prefs = Object.assign({ mode: "exam", shuffleQ: false, shuffleO: false }, store.get(LS.prefs, {}));
  let view = "home";
  let resultRec = null;
  let resultFilter = "all";
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
      $app.innerHTML = `<div class="page"><div class="card error"><h2>Can't load the question sets</h2>
        <p>Run the local server from the <code>quiz-site</code> folder, then reload:</p><pre><code>python3 server.py --open</code></pre></div></div>`;
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
    render();
  }

  // ---------- attempts ----------
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
      id: Date.now(), title: opts.title, setKey: opts.setKey || null, kind: opts.kind || "set",
      qkeys, optOrder, answers: {}, flags: {}, struck: {}, checked: {},
      mode: opts.mode || prefs.mode, shuffleQ, shuffleO, forceShuffle: !!forceShuffle,
      durationMs: ms, remainingMs: ms, current: 0, status: "running", startedAt: Date.now(),
    };
    persist();
    view = "exam";
    startTicker();
    render();
  }
  function startSet(key, extra) {
    const s = DATA.byKey[key];
    if (!s || !s.questions.length) return;
    const minutes = s.minutes || Math.ceil((s.questions.length * (DATA.config.defaultSecondsPerQuestion || 75)) / 60);
    startAttempt(Object.assign({
      title: s.title, setKey: key, kind: "set", minutes,
      qkeys: s.questions.map((qq) => key + "::" + qq.id),
      forceShuffle: s.shuffle === "always" || s.shuffle === true,
    }, extra || {}));
  }
  function startRandom() {
    const rm = DATA.config.randomMock || { questions: 40, minutes: 60 };
    const all = shuffle(Object.keys(DATA.q));
    const n = Math.min(rm.questions, all.length);
    startAttempt({ title: `Random mock · ${n} Q from all sets`, kind: "random", qkeys: all.slice(0, n),
      minutes: Math.round((rm.minutes * n) / rm.questions), shuffleO: prefs.shuffleO, shuffleQ: false });
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
    const t = document.getElementById("timer-val");
    if (t) {
      t.textContent = fmtTime(attempt.remainingMs);
      t.parentElement.classList.toggle("warn", attempt.remainingMs < 5 * 60000);
    }
    if (Date.now() - lastSave > 2000) persist();
  }
  function pause() { if (!attempt || attempt.status !== "running") return; tick(); stopTicker(); attempt.status = "paused"; persist(); render(); }
  function resume() { if (!attempt) return; view = "exam"; startTicker(); persist(); render(); }

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
    resultRec = rec; resultFilter = "all"; view = "results";
    render();
    window.scrollTo(0, 0);
  }
  function endExam() {
    const unanswered = attempt.qkeys.filter((k) => !(attempt.answers[k] || []).length).length;
    const flagged = attempt.qkeys.filter((k) => attempt.flags[k]).length;
    let msg = "End the exam and see your mark?";
    if (unanswered) msg = `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}` + (flagged ? ` and ${flagged} flagged` : "") + ". Unanswered questions score zero.\n\nEnd the exam anyway?";
    else if (flagged) msg = `All questions answered, ${flagged} still flagged for review.\n\nEnd the exam and see your mark?`;
    if (confirm(msg)) finish(false);
  }

  // ---------- rendering ----------
  function render() {
    if (view === "exam" && attempt) return renderExam();
    if (view === "navigator" && attempt) return renderNavigator();
    if (view === "results" && resultRec) return renderResults();
    view = "home"; renderHome();
  }

  function setStats(key) {
    const h = history().filter((r) => r.setKey === key && r.kind === "set");
    if (!h.length) return null;
    return { n: h.length, best: Math.max(...h.map((r) => r.result.percent)), last: h[0].result.percent };
  }

  function renderHome() {
    const pass = DATA.config.passPercent || 80;
    const totalQ = Object.keys(DATA.q).length;
    const h = history();
    const agg = {};
    h.forEach((r) => Object.entries(r.result.modules).forEach(([m, v]) => { const a = (agg[m] = agg[m] || { c: 0, t: 0 }); a.c += v.c; a.t += v.t; }));
    const groups = [];
    DATA.sets.forEach((s) => { let g = groups.find((x) => x.file === s.file); if (!g) groups.push((g = { file: s.file, sets: [] })); g.sets.push(s); });

    const card = (s) => {
      const st = setStats(s.key);
      const mods = {}; s.questions.forEach((q) => (mods[q.module] = (mods[q.module] || 0) + 1));
      const core = s.questions.filter((q) => q.core).length;
      const multi = s.questions.filter((q) => q.multi).length;
      return `<div class="set-card">
        <div class="set-card-top"><h3>${esc(s.title)}</h3>${s.shuffle ? '<span class="chip chip-accent">always shuffled</span>' : ""}</div>
        ${s.description ? `<p class="muted small">${inline(s.description)}</p>` : ""}
        <div class="set-facts"><span><b>${s.questions.length}</b> questions</span><span><b>${s.minutes || "?"}</b> min</span>${multi ? `<span><b>${multi}</b> multi-select</span>` : ""}${core ? `<span><b>${core}</b> core</span>` : ""}</div>
        <div class="chips">${Object.keys(mods).sort().map((m) => `<span class="chip" title="${esc(MODULE_NAMES[m] || "")}">${m} · ${mods[m]}</span>`).join("")}</div>
        ${s.warnings.length ? `<details class="warn-box"><summary>${s.warnings.length} question(s) skipped</summary><ul>${s.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></details>` : ""}
        <div class="set-card-bottom">
          <span class="muted small">${st ? `Best <b class="${st.best >= pass ? "ok" : ""}">${st.best}%</b> · Last ${st.last}% · ${st.n} attempt${st.n > 1 ? "s" : ""}` : "Not attempted yet"}</span>
          <button class="btn primary" data-action="start" data-key="${esc(s.key)}" ${attempt ? "disabled" : ""}>Start</button>
        </div></div>`;
    };

    $app.innerHTML = `
      <header class="topbar"><div class="topbar-inner">
        <div><div class="brand">CCDV-F Practice Exams</div><div class="brand-sub">${esc(DATA.config.examName || "")}</div></div>
        <button class="btn ghost light" data-action="reload" title="Re-read markdown files">↻ Reload sets</button>
      </div></header>
      <div class="page">
        ${notice ? `<div class="banner info">${esc(notice)}</div>` : ""}
        ${DATA.errors.length ? `<div class="banner error">${DATA.errors.map(esc).join("<br>")}</div>` : ""}
        ${attempt ? `<div class="banner resume"><div><b>Exam in progress:</b> ${esc(attempt.title)} · answered ${Object.values(attempt.answers).filter((a) => a.length).length}/${attempt.qkeys.length} · ${fmtTime(attempt.remainingMs)} left (paused)</div>
          <div class="row"><button class="btn primary" data-action="resume">Resume</button><button class="btn" data-action="discard">Discard</button></div></div>` : ""}

        <section class="card prefs">
          <div class="pref"><div class="pref-label">Mode</div>
            <div class="seg">
              <button class="${prefs.mode === "exam" ? "on" : ""}" data-action="pref-mode" data-val="exam">Exam</button>
              <button class="${prefs.mode === "practice" ? "on" : ""}" data-action="pref-mode" data-val="practice">Practice</button>
            </div>
            <div class="muted small">${prefs.mode === "exam" ? "Answers and reasoning appear only after you end the exam." : "Check each answer as you go; reasoning shows after you check. Still timed and marked."}</div>
          </div>
          <div class="pref"><div class="pref-label">Shuffle</div>
            <label class="check"><input type="checkbox" data-action="pref-shuffleQ" ${prefs.shuffleQ ? "checked" : ""}> Question order</label>
            <label class="check"><input type="checkbox" data-action="pref-shuffleO" ${prefs.shuffleO ? "checked" : ""}> Answer options</label>
          </div>
          <div class="pref"><div class="pref-label">Pool</div>
            <div class="muted small">${DATA.sets.length} sets · ${totalQ} questions · target ${pass}%</div>
            <button class="btn" data-action="random" ${attempt || !totalQ ? "disabled" : ""}>Random mock (${Math.min((DATA.config.randomMock || {}).questions || 40, totalQ)} Q)</button>
          </div>
        </section>

        ${Object.keys(agg).length ? `<section class="card"><h2>Module accuracy across all attempts</h2>${moduleBars(agg)}</section>` : ""}

        ${groups.map((g) => `<section><h2 class="group-title">${esc(g.file.replace(/^\.\.\//, ""))}</h2><div class="set-grid">${g.sets.map(card).join("")}</div></section>`).join("")}

        ${h.length ? `<section class="card"><h2>Recent attempts</h2><div class="table-wrap"><table class="hist"><thead><tr><th>When</th><th>Set</th><th>Mode</th><th>Score</th><th>Time used</th><th></th></tr></thead><tbody>
          ${h.slice(0, 15).map((r, i) => `<tr><td>${fmtDate(r.finishedAt)}</td><td>${esc(r.title)}</td><td>${r.mode}</td>
            <td><b class="${r.result.percent >= pass ? "ok" : "bad"}">${r.result.correct}/${r.result.total}</b> (${r.result.percent}%)</td>
            <td>${fmtTime(r.durationMs - r.remainingMs)}${r.timeUp ? " ⏰" : ""}</td><td><button class="btn small" data-action="view-result" data-idx="${i}">Review</button></td></tr>`).join("")}
          </tbody></table></div><div class="row end"><button class="btn small ghost" data-action="clear-history">Clear history</button></div></section>` : ""}

        <section class="card muted small add-help">
          <b>Add more sets:</b> save a Claude-generated markdown file into <code>quiz-site/sets/</code> (format in <code>quiz-site/FORMAT.md</code>), then ${DATA_SOURCE === "sets.json" ? "push it to GitHub; this hosted copy rebuilds automatically within a minute or two" : "press <b>Reload sets</b>"}. Questions without an answer in the key are skipped and listed on the card.
          <br><b>Keys during an exam:</b> A–F or 1–6 pick · ←/→ previous/next · F flag · P pause · Enter check (practice).
        </section>
      </div>`;
    notice = "";
  }

  function moduleBars(mods) {
    return `<div class="mod-bars">${Object.keys(mods).sort().map((m) => {
      const v = mods[m], pct = v.t ? Math.round((100 * v.c) / v.t) : 0;
      return `<div class="mod-row"><div class="mod-name"><b>${m}</b> <span class="muted">${esc(MODULE_NAMES[m] || "")}</span></div>
        <div class="bar"><div class="bar-fill ${pct >= (DATA.config.passPercent || 80) ? "ok" : pct >= 60 ? "mid" : "bad"}" style="width:${pct}%"></div></div>
        <div class="mod-val">${v.c}/${v.t} · ${pct}%</div></div>`;
    }).join("")}</div>`;
  }

  function examHeader() {
    const answered = attempt.qkeys.filter((k) => (attempt.answers[k] || []).length).length;
    return `<header class="exam-top">
        <div class="exam-title">${esc(attempt.title)}</div>
        <div class="exam-meta">${view === "navigator" ? "Review screen" : `Question <b>${attempt.current + 1}</b> of ${attempt.qkeys.length}`}
          <span class="pill">${attempt.mode === "practice" ? "Practice" : "Exam"}</span></div>
        <div class="timer ${attempt.remainingMs < 5 * 60000 ? "warn" : ""}" title="Time remaining">⏱ <span id="timer-val">${fmtTime(attempt.remainingMs)}</span></div>
        <button class="btn light" data-action="pause">❚❚ Pause</button>
      </header>
      <div class="progress" title="${answered} of ${attempt.qkeys.length} answered"><div style="width:${(100 * answered) / attempt.qkeys.length}%"></div></div>`;
  }

  function pausedOverlay() {
    if (attempt.status !== "paused") return "";
    const answered = attempt.qkeys.filter((k) => (attempt.answers[k] || []).length).length;
    return `<div class="overlay"><div class="overlay-box">
      <h2>Exam paused</h2>
      <p class="muted">The timer is stopped and questions are hidden.</p>
      <div class="pause-stats"><div><b>${fmtTime(attempt.remainingMs)}</b><span>remaining</span></div><div><b>${answered}/${attempt.qkeys.length}</b><span>answered</span></div></div>
      <div class="row center"><button class="btn primary big" data-action="resume">▶ Resume</button><button class="btn" data-action="home">Back to sets</button></div>
      <p class="muted small">Progress is saved in this browser, so you can close the tab and resume later.</p>
    </div></div>`;
  }

  function renderExam() {
    const k = attempt.qkeys[attempt.current];
    const q = DATA.q[k];
    const chosen = attempt.answers[k] || [];
    const checked = attempt.mode === "practice" && attempt.checked[k];
    const order = attempt.optOrder[k] || q.options.map((o) => o.letter);
    const struck = attempt.struck[k] || [];
    const need = q.answer.length;
    const hidden = attempt.status === "paused";
    const opts = order.map((L, i) => {
      const o = q.options.find((x) => x.letter === L);
      if (!o) return "";
      const sel = chosen.includes(L);
      let cls = sel ? " selected" : "";
      if (checked) cls += q.answer.includes(L) ? " correct" : sel ? " wrong" : "";
      if (struck.includes(L) && !sel) cls += " struck";
      return `<div class="opt${cls}" data-action="${checked ? "" : "choose"}" data-letter="${L}">
        <span class="box ${q.multi ? "sq" : ""}">${sel ? (q.multi ? "✓" : "●") : ""}</span>
        <span class="letter">${LETTERS[i]}.</span>
        <span class="text">${inline(o.text)}</span>
        ${checked && attempt.shuffleO ? `<span class="orig" title="Letter used in the reasoning">orig. ${L}</span>` : ""}
        ${checked ? "" : `<button class="strike" data-action="strike" data-letter="${L}" title="Strike out this option (visual only)">${struck.includes(L) ? "↺" : "✕"}</button>`}
      </div>`;
    }).join("");
    const disp = (L) => LETTERS[order.indexOf(L)] + (attempt.shuffleO ? ` (orig. ${L})` : "");
    const ok = checked && sameSet(chosen, q.answer);
    const isLast = attempt.current === attempt.qkeys.length - 1;
    $app.innerHTML = `<div class="exam">${examHeader()}
      <main class="q-area ${hidden ? "blurred" : ""}">
        <div class="q-head"><span class="qnum">Question ${attempt.current + 1}</span>
          <span class="chip">${esc(q.module)}</span>${q.core ? '<span class="chip chip-accent" title="Repeated MUST REMEMBER fact">core</span>' : ""}
          ${attempt.kind !== "set" ? `<span class="chip">${esc(q.setTitle)} · ${esc(q.id)}</span>` : `<span class="muted small">${esc(q.id)}</span>`}
          ${attempt.flags[k] ? '<span class="chip chip-flag">⚑ Flagged</span>' : ""}</div>
        <div class="stem">${md(q.stem)}</div>
        <div class="hint">${q.multi ? `Choose <b>${need}</b> answers.` : "Choose <b>one</b> answer."} <span id="hint-msg"></span></div>
        <div class="options">${opts}</div>
        ${attempt.mode === "practice" ? (checked
          ? `<div class="feedback ${ok ? "ok" : "bad"}"><div class="fb-head">${ok ? "✓ Correct" : "✗ Incorrect"} · Answer: ${q.answer.map(disp).join(", ")}</div>${q.reasoning ? `<div class="reasoning">${md(q.reasoning)}</div>` : ""}</div>`
          : `<div class="row"><button class="btn primary" data-action="check" ${chosen.length === need ? "" : "disabled"}>Check answer</button></div>`) : ""}
      </main>
      <footer class="exam-bottom">
        <div class="row"><button class="btn" data-action="navigator">☰ Review</button>
          <button class="btn ${attempt.flags[k] ? "flag-on" : ""}" data-action="flag">⚑ ${attempt.flags[k] ? "Unflag" : "Flag for review"}</button></div>
        <div class="row"><button class="btn" data-action="prev" ${attempt.current === 0 ? "disabled" : ""}>◀ Previous</button>
          ${isLast ? `<button class="btn" data-action="navigator">Next ▶</button>` : `<button class="btn primary" data-action="next">Next ▶</button>`}</div>
        <div class="row"><button class="btn danger" data-action="end">End exam</button></div>
      </footer>
      ${pausedOverlay()}</div>`;
  }

  function renderNavigator() {
    const ks = attempt.qkeys;
    const unanswered = ks.filter((k) => !(attempt.answers[k] || []).length).length;
    const flagged = ks.filter((k) => attempt.flags[k]).length;
    $app.innerHTML = `<div class="exam">${examHeader()}
      <main class="q-area ${attempt.status === "paused" ? "blurred" : ""}">
        <h2>Review your answers</h2>
        <p class="muted">${ks.length - unanswered} answered · <b class="${unanswered ? "bad" : "ok"}">${unanswered} unanswered</b> · ${flagged} flagged. Select a question to go to it.</p>
        <div class="legend"><span class="cell answered">1</span> answered <span class="cell">1</span> unanswered <span class="cell flagged">1</span> flagged</div>
        <div class="nav-grid">${ks.map((k, i) => {
          const a = (attempt.answers[k] || []).length;
          return `<button class="cell ${a ? "answered" : ""} ${attempt.flags[k] ? "flagged" : ""} ${i === attempt.current ? "current" : ""}" data-action="goto" data-idx="${i}" title="${esc(DATA.q[k].id)}">${i + 1}</button>`;
        }).join("")}</div>
        <div class="row">
          ${unanswered ? `<button class="btn" data-action="goto-first" data-what="unanswered">Go to first unanswered</button>` : ""}
          ${flagged ? `<button class="btn" data-action="goto-first" data-what="flagged">Go to first flagged</button>` : ""}
        </div>
      </main>
      <footer class="exam-bottom">
        <div class="row"><button class="btn" data-action="back-to-q">◀ Back to question ${attempt.current + 1}</button></div>
        <div class="row"><button class="btn danger" data-action="end">End exam &amp; see mark</button></div>
      </footer>${pausedOverlay()}</div>`;
  }

  function renderResults() {
    const r = resultRec, res = r.result, pass = DATA.config.passPercent || 80;
    const Q = (k) => (r.snapshot && r.snapshot[k]) || DATA.q[k];
    const items = res.perQ.map((p, i) => ({ p, i, q: Q(p.k), flagged: !!(r.flags || {})[p.k] })).filter((x) => x.q);
    const filters = {
      all: () => true, incorrect: (x) => !x.p.correct, correct: (x) => x.p.correct,
      flagged: (x) => x.flagged, core: (x) => x.q.core, unanswered: (x) => !x.p.answered,
    };
    const shown = items.filter(filters[resultFilter] || filters.all);
    const count = (f) => items.filter(filters[f]).length;
    const wrong = items.filter((x) => !x.p.correct);
    const used = r.durationMs - r.remainingMs;
    $app.innerHTML = `
      <header class="topbar"><div class="topbar-inner"><div><div class="brand">Score report</div><div class="brand-sub">${esc(r.title)}</div></div>
        <button class="btn ghost light" data-action="home">← All sets</button></div></header>
      <div class="page">
        <section class="card score-card">
          <div class="score-big ${res.percent >= pass ? "ok" : "bad"}">${res.percent}%</div>
          <div>
            <div class="score-line"><b>${res.correct}</b> of ${res.total} correct · ${res.percent >= pass ? `<span class="ok">at or above the ${pass}% target</span>` : `<span class="bad">below the ${pass}% target</span>`}</div>
            <div class="muted">${r.timeUp ? "⏰ Time ran out · " : ""}Time used ${fmtTime(used)} of ${fmtTime(r.durationMs)} · ${r.mode} mode · ${fmtDate(r.finishedAt)}</div>
            ${res.core.t ? `<div class="muted">Core MUST-REMEMBER items: <b>${res.core.c}/${res.core.t}</b></div>` : ""}
            <div class="row" style="margin-top:12px">
              ${r.kind === "set" && DATA.byKey[r.setKey] ? `<button class="btn primary" data-action="retake" data-shuffle="0">Retake</button><button class="btn" data-action="retake" data-shuffle="1">Retake shuffled</button>` : ""}
              ${wrong.length ? `<button class="btn" data-action="retake-wrong">Retry ${wrong.length} missed</button>` : ""}
            </div>
          </div>
        </section>
        <section class="card"><h2>By module</h2>${moduleBars(res.modules)}</section>
        <section class="card">
          <div class="review-head"><h2>Answers &amp; reasoning</h2>
            <div class="seg">${["all", "incorrect", "correct", "unanswered", "flagged", "core"].filter((f) => f === "all" || count(f)).map((f) => `<button class="${resultFilter === f ? "on" : ""}" data-action="rfilter" data-val="${f}">${f[0].toUpperCase() + f.slice(1)} (${count(f)})</button>`).join("")}</div></div>
          ${r.shuffleO ? '<p class="muted small">Options are listed in their original order so the letters match the reasoning.</p>' : ""}
          ${shown.map(({ p, i, q, flagged }) => `
            <article class="rev ${p.correct ? "ok" : "bad"}">
              <div class="q-head"><span class="qnum">${p.correct ? "✓" : "✗"} Q${i + 1}</span><span class="chip">${esc(q.module)}</span>${q.core ? '<span class="chip chip-accent">core</span>' : ""}
                <span class="muted small">${esc(q.setTitle || "")} · ${esc(q.id)}</span>${flagged ? '<span class="chip chip-flag">⚑</span>' : ""}</div>
              <div class="stem">${md(q.stem)}</div>
              <div class="options review">${q.options.map((o) => {
                const isA = q.answer.includes(o.letter), isC = p.chosen.includes(o.letter);
                return `<div class="opt ${isA ? "correct" : ""} ${isC && !isA ? "wrong" : ""} ${isC ? "selected" : ""}"><span class="letter">${o.letter}.</span><span class="text">${inline(o.text)}</span>${isC ? '<span class="tag">your pick</span>' : ""}${isA ? '<span class="tag ok">answer</span>' : ""}</div>`;
              }).join("")}</div>
              <div class="ans-line">Your answer: <b>${p.chosen.length ? p.chosen.slice().sort().join(", ") : "—"}</b> · Correct: <b>${q.answer.join(", ")}</b></div>
              ${q.reasoning ? `<div class="reasoning">${md(q.reasoning)}</div>` : ""}
            </article>`).join("") || '<p class="muted">Nothing in this filter.</p>'}
        </section>
      </div>`;
  }

  // ---------- interactions ----------
  function choose(L) {
    const k = attempt.qkeys[attempt.current], q = DATA.q[k];
    if (attempt.mode === "practice" && attempt.checked[k]) return;
    let cur = (attempt.answers[k] || []).slice();
    if (q.multi) {
      if (cur.includes(L)) cur = cur.filter((x) => x !== L);
      else if (cur.length >= q.answer.length) {
        const m = document.getElementById("hint-msg");
        if (m) { m.textContent = `You've already selected ${q.answer.length}. Deselect one first.`; m.className = "bad"; }
        return;
      } else cur.push(L);
    } else cur = [L];
    attempt.answers[k] = cur;
    if (attempt.struck[k]) attempt.struck[k] = attempt.struck[k].filter((x) => x !== L);
    persist(); renderExam();
  }
  function go(i) { attempt.current = Math.max(0, Math.min(attempt.qkeys.length - 1, i)); view = "exam"; persist(); render(); window.scrollTo(0, 0); }

  $app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || !el.dataset.action || el.disabled) return;
    const a = el.dataset.action;
    if (a === "strike") e.stopPropagation();
    const k = attempt && attempt.qkeys[attempt.current];
    switch (a) {
      case "start": return startSet(el.dataset.key);
      case "random": return startRandom();
      case "reload": notice = "Sets reloaded."; return load();
      case "resume": return resume();
      case "discard": if (confirm("Discard the exam in progress? Its answers will be lost.")) { attempt = null; store.del(LS.attempt); renderHome(); } return;
      case "pref-mode": prefs.mode = el.dataset.val; store.set(LS.prefs, prefs); return renderHome();
      case "pause": return pause();
      case "home": stopTicker(); if (attempt && attempt.status === "running") { attempt.status = "paused"; persist(); } view = "home"; return render();
      case "choose": return choose(el.dataset.letter);
      case "strike": {
        const s = new Set(attempt.struck[k] || []);
        s.has(el.dataset.letter) ? s.delete(el.dataset.letter) : s.add(el.dataset.letter);
        attempt.struck[k] = [...s]; persist(); return renderExam();
      }
      case "check": attempt.checked[k] = true; persist(); return renderExam();
      case "flag": attempt.flags[k] = !attempt.flags[k]; persist(); return renderExam();
      case "prev": return go(attempt.current - 1);
      case "next": return go(attempt.current + 1);
      case "navigator": view = "navigator"; return render();
      case "back-to-q": view = "exam"; return render();
      case "goto": return go(parseInt(el.dataset.idx, 10));
      case "goto-first": {
        const i = attempt.qkeys.findIndex((kk) => el.dataset.what === "flagged" ? attempt.flags[kk] : !(attempt.answers[kk] || []).length);
        return go(i < 0 ? 0 : i);
      }
      case "end": return endExam();
      case "view-result": resultRec = history()[parseInt(el.dataset.idx, 10)]; resultFilter = "all"; view = "results"; render(); return window.scrollTo(0, 0);
      case "rfilter": resultFilter = el.dataset.val; return renderResults();
      case "retake": return startSet(resultRec.setKey, el.dataset.shuffle === "1" ? { shuffleQ: true, shuffleO: true, mode: resultRec.mode } : { shuffleQ: false, shuffleO: false, mode: resultRec.mode });
      case "retake-wrong": {
        const ks = resultRec.result.perQ.filter((p) => !p.correct && DATA.q[p.k]).map((p) => p.k);
        if (!ks.length) { alert("Those questions are no longer in the loaded sets."); return; }
        const perQ = resultRec.durationMs / resultRec.qkeys.length;
        return startAttempt({ title: `Retry missed · ${resultRec.title}`, kind: "retry", qkeys: ks,
          minutes: Math.max(1, Math.ceil((perQ * ks.length) / 60000)), mode: resultRec.mode, shuffleQ: true, shuffleO: true });
      }
      case "clear-history": if (confirm("Delete all attempt history in this browser?")) { store.del(LS.history); renderHome(); } return;
    }
  });
  $app.addEventListener("change", (e) => {
    const a = e.target.dataset.action;
    if (a === "pref-shuffleQ") prefs.shuffleQ = e.target.checked;
    else if (a === "pref-shuffleO") prefs.shuffleO = e.target.checked;
    else return;
    store.set(LS.prefs, prefs);
  });
  document.addEventListener("keydown", (e) => {
    if (!attempt || e.metaKey || e.ctrlKey || e.altKey) return;
    if (view !== "exam" && view !== "navigator") return;
    const key = e.key;
    if (attempt.status === "paused") { if (key === "p" || key === "P" || key === "Enter") { e.preventDefault(); resume(); } return; }
    if (key === "p" || key === "P") { e.preventDefault(); return pause(); }
    if (view !== "exam") return;
    const k = attempt.qkeys[attempt.current];
    const order = attempt.optOrder[k];
    let idx = LETTERS.indexOf(key.toUpperCase());
    if (/^[1-6]$/.test(key)) idx = parseInt(key, 10) - 1;
    if (idx >= 0 && idx < order.length && key.length === 1 && key.toLowerCase() !== "f") { e.preventDefault(); return choose(order[idx]); }
    if (key === "f" || key === "F") { attempt.flags[k] = !attempt.flags[k]; persist(); return renderExam(); }
    if (key === "ArrowRight") { e.preventDefault(); return attempt.current < attempt.qkeys.length - 1 ? go(attempt.current + 1) : (view = "navigator", render()); }
    if (key === "ArrowLeft") { e.preventDefault(); return go(attempt.current - 1); }
    if (key === "Enter" && attempt.mode === "practice" && !attempt.checked[k] && (attempt.answers[k] || []).length === DATA.q[k].answer.length) {
      e.preventDefault(); attempt.checked[k] = true; persist(); return renderExam();
    }
  });
  document.addEventListener("visibilitychange", () => { if (attempt) { if (attempt.status === "running") tick(); persist(); } });
  window.addEventListener("beforeunload", () => { if (attempt) { if (attempt.status === "running") tick(); persist(); } });

  load();
})();
