# Practice exam site: how to run it and add sets

## Run it
```bash
cd "claude-dev-exam-prep/quiz-site"
python3 server.py --open
```
Or double-click `Start Quiz.command` in Finder. The site runs at http://localhost:8765 (Python 3 only, nothing to install). Progress, paused exams and score history are saved in your browser's local storage.

## Hosted copy (GitHub Pages)
https://aimanamri.github.io/claude-dev-exam-prep/ is rebuilt by `.github/workflows/pages.yml` on every push to `main`. The workflow runs `python3 quiz-site/build_static.py`, which copies the site and bundles every markdown source into `sets.json` (the app reads that file when `server.py` isn't running). To check a static build locally:
```bash
python3 quiz-site/build_static.py --out /tmp/site && python3 -m http.server 8766 -d /tmp/site
```

## Where questions come from
`quiz.config.json` lists the sources:
- `../03-practice-exams.md`: Sets A–D (unchanged; module ranges and timings are set in the config)
- `../00-mso-foundations-notes.md`: the M1 mini set (F1–F10)
- `sets/`: **every `.md` file in this folder** (Sets E–H, the Must-Remember drill, and anything you add)

Files whose names start with `_` or `.` are ignored, so you can park drafts as `_draft.md`.

## Add a set
1. Ask Claude for a new set using the prompt below, or write one yourself.
2. Save it as `sets/set-<ID>.md` (e.g. `sets/set-J.md`).
3. Press **↻ Reload sets** on the home page. Any question without a valid answer is skipped and listed on the set's card.

### File format
```markdown
---
title: Set J · Mock exam 5        # card title
minutes: 60                       # time limit (or secondsPerQuestion: 90)
description: One line shown on the card.
shuffle: always                   # optional: always shuffle questions and options
---
# SET J (mock exam 5)

## M1 Foundations                 # any heading containing M1–M5 sets the module for the questions below it

**J1.** Question stem. Add #core at the end to tag a repeated MUST-REMEMBER item.
- A. Option text
- B. Option text
- C. Option text
- D. Option text

**J2.** *(Choose TWO.)* Multi-select stem.
- A. ...
- B. ...
- C. ...
- D. ...
- E. ...

## M2 Prompting, Agents & Tool Use
...

# ANSWER KEY & REASONING

**J1 – C.** Reasoning shown after the exam (and after "Check answer" in Practice mode).

**J2 – A, D.** A multi-select answer lists every correct letter; it's scored all-or-nothing.
```

Rules the parser relies on:
- Question IDs are 1–3 capital letters plus a number (`J1`, `MR12`), written as `**J1.**`. The letters must be **unique to the set**, because they're how questions are grouped (one file may hold several sets, like `03-practice-exams.md`).
- Options are list items `- A.` to `- F.`.
- Answers are `**J1 – C.**` (an en dash, a hyphen, or just a space all work) followed by the reasoning. A table row `| J1 | C |` also works as a fallback.
- More than one answer letter makes the question multi-select; the UI asks for exactly that many.
- Markdown in stems and reasoning: `code`, **bold**, *italic*, bullet lists and fenced code blocks.

## Prompt to generate a new set with Claude
```
Read claude-dev-exam-prep/00-mso-foundations-notes.md and 01-full-study-notes.md
(the CCDV-F study notes) and quiz-site/FORMAT.md.
Write a new Pearson-style practice set in that exact format as
claude-dev-exam-prep/quiz-site/sets/set-<NEXT LETTER>.md:
- 40 questions, minutes: 60, IDs <LETTER>1–<LETTER>40 (letter not used by any existing set:
  A–J and MR are taken)
- module split: M1 6, M2 12, M3 9, M4 8, M5 5, under "## M<n> ..." headings
- 10 items tagged #core that re-test these facts from a new angle: context-window edge
  behaviors; sampling params → 400 / temp 0 not guaranteed; tool_use/tool_result pairing;
  thinking blocks returned unchanged; streaming parse/append rules; wrong tool after N
  turns = context; deny beats allow + enterprise managed deny; PreToolUse exit 2 blocks;
  retriable vs terminal + SDK retries + refusal = 200; pin full model ID + eval gate
- 3–4 "(Choose TWO.)" items with 5 options, 2+ NOT/FALSE stems, at least one ordering item
- scenario stems with plausible distractors; balance correct letters across A–D
- every answer gets 1–3 sentences of reasoning that says why the distractors are wrong
- use only facts from the notes; don't invent numbers
Then check that it parses: every question has an answer and the letters exist.
```
