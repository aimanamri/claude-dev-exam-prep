// Markdown → question sets. Format reference: FORMAT.md
// Handles the existing 03-practice-exams.md, the inline "A. … · B. …" mini set
// in 00-mso-foundations-notes.md, and new files in ./sets/.
(function (global) {
  const QID = /^\*\*([A-Z]{1,3})(\d{1,3})\.\*\*\s*(.*)$/;
  const OPT = /^\s*[-*]\s+([A-F])\.\s+(.*)$/;
  const INLINE_OPT = /^([A-F])\.\s+/;
  const ANS = /^\s*(?:[-*]\s+)?\*\*([A-Z]{1,3})(\d{1,3})\s*(?:[–—-]\s*)?([A-F](?:\s*,\s*[A-F])*)\.?\*\*[.:]?\s*(.*)$/;
  const HEADING = /^(#{1,6})\s+(.*)$/;
  const SET_HEAD = /^#{1,2}\s+SET\s+([A-Z]{1,3})\b\s*(.*)$/i;
  const MODULE = /\bM([1-5])\b/;
  const CORE_TAG = /(^|\s)#core\b/i;

  function parseFrontmatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { meta: {}, body: text };
    const meta = {};
    m[1].split(/\r?\n/).forEach((line) => {
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (!kv) return;
      let v = kv[2].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
      if (/^\d+(\.\d+)?$/.test(v)) v = Number(v);
      else if (v === "true") v = true;
      else if (v === "false") v = false;
      meta[kv[1]] = v;
    });
    return { meta, body: text.slice(m[0].length) };
  }

  function inRange(num, spec) {
    return String(spec).split(",").some((part) => {
      const [a, b] = part.split("-").map((s) => parseInt(s, 10));
      return b ? num >= a && num <= b : num === a;
    });
  }

  function parseFile(file) {
    const { meta, body } = parseFrontmatter(file.content);
    const lines = body.split(/\r?\n/);
    const questions = [];
    const answers = {};        // "A1" -> { letters, reasoning }
    const tableAnswers = {};   // fallback from answer-key tables
    const setTitles = {};      // prefix -> title from "# SET X ..." header
    const firstHeadingFor = {}; // prefix -> nearest heading before its first question
    let lastHeading = "";
    let module = null;
    let q = null;       // question being built
    let qPhase = null;  // "stem" | "options"
    let ans = null;     // answer being built (for multi-line reasoning)
    let inFence = false;

    const finishQ = () => {
      if (q) {
        q.stem = q.stem.replace(/\s+$/, "");
        questions.push(q);
      }
      q = null; qPhase = null;
    };
    const finishAns = () => { ans = null; };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.replace(/\s+$/, "");

      // code fences inside stems are kept verbatim
      if (q && qPhase === "stem" && /^\s*```/.test(line)) {
        inFence = !inFence; q.stem += raw + "\n"; continue;
      }
      if (inFence && q) { q.stem += raw + "\n"; continue; }

      const h = line.match(HEADING);
      if (h) {
        finishQ(); finishAns();
        const text = h[2].trim();
        const sh = line.match(SET_HEAD);
        if (sh) {
          setTitles[sh[1].toUpperCase()] = ("Set " + sh[1].toUpperCase() + " " + sh[2]).trim();
          module = null;
        } else {
          const mm = text.match(MODULE);
          if (mm) module = "M" + mm[1];
        }
        lastHeading = text;
        continue;
      }

      const am = line.match(ANS);
      if (am) {
        finishQ(); finishAns();
        const key = am[1] + am[2];
        ans = { letters: am[3].split(/\s*,\s*/), reasoning: am[4] || "" };
        answers[key] = ans;
        continue;
      }

      const qm = line.match(QID);
      if (qm) {
        finishQ(); finishAns();
        const prefix = qm[1], num = parseInt(qm[2], 10);
        if (!(prefix in firstHeadingFor)) firstHeadingFor[prefix] = lastHeading;
        q = { prefix, num, id: prefix + num, stem: qm[3] + "\n", options: [], module };
        qPhase = "stem";
        continue;
      }

      if (/^\|/.test(line)) {
        const cells = line.split("|").map((c) => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        for (let c = 0; c + 1 < cells.length; c += 2) {
          const id = cells[c].match(/^([A-Z]{1,3}\d{1,3})$/);
          const letters = cells[c + 1].match(/^[A-F](\s*,\s*[A-F])*$/);
          if (id && letters) tableAnswers[id[1]] = cells[c + 1].split(/\s*,\s*/);
        }
        continue;
      }

      if (q) {
        const om = line.match(OPT);
        if (om) {
          q.options.push({ letter: om[1], text: om[2] });
          qPhase = "options";
          continue;
        }
        if (INLINE_OPT.test(line.trim()) && / · [A-F]\.\s/.test(line)) {
          line.trim().split(/\s+·\s+(?=[A-F]\.\s)/).forEach((part) => {
            const pm = part.match(/^([A-F])\.\s+(.*)$/);
            if (pm) q.options.push({ letter: pm[1], text: pm[2] });
          });
          qPhase = "options";
          continue;
        }
        if (line.trim() === "" || /^---+$/.test(line.trim()) || /^<!--/.test(line.trim())) {
          if (qPhase === "options") finishQ();
          else if (q) q.stem += "\n";
          continue;
        }
        if (qPhase === "stem") { q.stem += raw + "\n"; continue; }
        // indented continuation of the last option
        if (qPhase === "options" && /^\s{2,}\S/.test(raw) && q.options.length) {
          q.options[q.options.length - 1].text += " " + line.trim();
          continue;
        }
        finishQ();
        continue;
      }

      if (ans) {
        if (line.trim() === "") { finishAns(); continue; }
        ans.reasoning += (ans.reasoning ? "\n" : "") + line;
      }
    }
    finishQ();

    // Group into sets by ID prefix (keeps sets apart even across files)
    const overrides = file.sets || {};
    const byPrefix = {};
    questions.forEach((qq) => {
      (byPrefix[qq.prefix] = byPrefix[qq.prefix] || []).push(qq);
    });
    const prefixes = Object.keys(byPrefix);
    const sets = prefixes.map((prefix) => {
      const ov = overrides[prefix] || {};
      const single = prefixes.length === 1;
      const warnings = [];
      const qs = byPrefix[prefix].map((qq) => {
        const a = answers[qq.id];
        const letters = a ? a.letters : tableAnswers[qq.id];
        let mod = qq.module;
        if (ov.modules) {
          for (const [m, spec] of Object.entries(ov.modules)) if (inRange(qq.num, spec)) mod = m;
        }
        const core = CORE_TAG.test(qq.stem);
        const stem = qq.stem.replace(/(^|\s)#core\b/gi, "$1").trim();
        const optLetters = qq.options.map((o) => o.letter);
        const problems = [];
        if (!letters) problems.push("no answer in key");
        else if (letters.some((l) => !optLetters.includes(l))) problems.push("answer letter not among options");
        if (qq.options.length < 2) problems.push("fewer than 2 options");
        if (problems.length) warnings.push(`${qq.id}: ${problems.join(", ")}`);
        return {
          id: qq.id, num: qq.num, stem, options: qq.options,
          answer: letters || [], reasoning: a ? a.reasoning.trim() : "",
          multi: letters ? letters.length > 1 : /choose\s+(two|three|2|3)/i.test(stem),
          module: mod || "—", core, valid: problems.length === 0,
        };
      });
      const key = file.file + "#" + prefix;
      const title = ov.title || (single && meta.title) || setTitles[prefix] ||
        firstHeadingFor[prefix] || ("Set " + prefix);
      const valid = qs.filter((x) => x.valid);
      const minutes = ov.minutes || (single && meta.minutes) ||
        Math.ceil((valid.length * (ov.secondsPerQuestion || meta.secondsPerQuestion || 0)) / 60) || null;
      return {
        key, prefix, title, file: file.file, fileName: file.name,
        description: ov.description || (single && meta.description) || "",
        minutes, shuffle: ov.shuffle || (single && meta.shuffle) || false,
        tags: (single && meta.tags) ? String(meta.tags).split(/\s*,\s*/) : [],
        order: ov.order != null ? ov.order : (single && meta.order != null ? meta.order : null),
        questions: valid, warnings, mtime: file.mtime,
      };
    });
    return sets;
  }

  global.QuizParser = { parseFile, parseFrontmatter };
})(typeof window !== "undefined" ? window : globalThis);
