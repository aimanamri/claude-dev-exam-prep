<div align="center">

<img src="assets/hero.gif" alt="DEV: Claude Certified Developer – Foundations (CCDV-F) exam prep" width="100%">

<br>

[![Live exam site](https://img.shields.io/badge/Live%20exam%20site-open-D97757?style=for-the-badge)](https://aimanamri.github.io/claude-dev-exam-prep/)
[![Deploy](https://img.shields.io/github/actions/workflow/status/aimanamri/claude-dev-exam-prep/pages.yml?branch=main&style=for-the-badge&label=pages&labelColor=1a1917)](https://github.com/aimanamri/claude-dev-exam-prep/actions/workflows/pages.yml)
![Questions](https://img.shields.io/badge/questions-393-F3AA8A?style=for-the-badge&labelColor=1a1917)
![Sets](https://img.shields.io/badge/sets-12-F3AA8A?style=for-the-badge&labelColor=1a1917)

**Notes, practice exams and a timed exam simulator for the Claude Certified Developer – Foundations certification.**

[Quick start](#quick-start) · [Study path](#study-path) · [Exam site](#practice-exam-site) · [Helpdesk project](#helpdesk-project) · [Repo map](#repo-map)

<img src="assets/divider.gif" alt="" width="100%">

</div>

## Quick start

Pick the path that matches where you are.

| I want to… | Go to |
|---|---|
| **Test myself now** | [Open the live exam site](https://aimanamri.github.io/claude-dev-exam-prep/): nothing to install |
| **Learn the material** | [`00-mso-foundations-notes.md`](00-mso-foundations-notes.md), then [`01-full-study-notes.md`](01-full-study-notes.md) |
| **Revise on the move** | [`02-commute-recall.md`](02-commute-recall.md): short recall cards and number/header flash lists |
| **See it applied** | [`helpdesk-project/`](helpdesk-project/00-README.md): one IT-helpdesk assistant built across every module |

## Study path

A suggested order. Each step feeds the next.

| Step | Do this | Why |
|:-:|---|---|
| **1** | Read the M1 notes ([`00`](00-mso-foundations-notes.md)) and try its 10-question mini set | Tokens, context window, sampling, model tiers, prompting modes, SDK/REST/streaming/batch |
| **2** | Read the full notes ([`01`](01-full-study-notes.md)) | M2–M5: must-remember facts, syntax, debug priority, trade-offs and fixes |
| **3** | Walk through the [helpdesk project](helpdesk-project/00-README.md) | See each module's decision in one realistic build |
| **4** | Take Sets A–D in **Practice mode** | Check each answer as you go and read the reasoning |
| **5** | Take mock Sets E–H and hard Sets I–J in **Exam mode** | 40 Q / 60 min and 30 Q / 60 min, answers at the end |
| **6** | Run the **Must-Remember drill** daily and retry what you missed | 35 rapid-recall questions, re-shuffled every attempt; weak modules show up in the score report |

## Practice exam site

<a href="https://aimanamri.github.io/claude-dev-exam-prep/"><img src="quiz-site/icons/icon-192.png" alt="CCDV-F Exam Portal icon" width="64" height="64" align="left"></a>

**[▶ Open the exam site: aimanamri.github.io/claude-dev-exam-prep](https://aimanamri.github.io/claude-dev-exam-prep/)**<br>
Free, no sign-up, runs in the browser. It's rebuilt by GitHub Actions on every push to `main`.

<br clear="left">

| Exam | Format |
|---|---|
| Sets A–D, M1 mini set | Study-pack practice sets |
| Sets E–H | Mock exams: 40 Q / 60 min, 10 repeated "core" items each |
| Sets I–J | Hard Good/Better/Best judgment sets: 30 Q / 60 min |
| Must-Remember drill | 35 rapid-recall questions, always shuffled |
| Random mock | 40 questions drawn from the whole 393-question pool |

**Features**
- **Exam portal:** dashboard with exam cards and status badges, a briefing screen before each exam, and your module accuracy and attempt history.
- **Exam screen:** a timer you can hide, pause/resume, flag for review, a question navigator, strike-out on each answer, and Submit on the last question.
- **Two modes:** Exam mode (answers and reasoning at the end) or Practice mode (check each answer as you go).
- **Accessibility:** A−/A+ text size, a high-contrast dark mode, a highlighter, a resizable split view, full keyboard control (<kbd>A</kbd>–<kbd>E</kbd>, <kbd>←</kbd>/<kbd>→</kbd>, <kbd>F</kbd> flag, <kbd>N</kbd> navigator, <kbd>P</kbd> pause), and WCAG AA contrast in both themes.
- **Score report:** a per-module breakdown, reasoning for every answer, retake, and "retry missed".
- **Installable and offline:** add it to your home screen or desktop (Chrome's install icon, or **Share → Add to Home Screen** on iPhone) and it keeps working without a connection.
- **Private:** progress and history stay in your browser's `localStorage`. There are no accounts and no tracking.

<details>
<summary><b>Run it locally</b></summary>

Python 3 only, no dependencies.

```bash
cd quiz-site
python3 server.py --open      # http://localhost:8765
```

</details>

<details>
<summary><b>Add your own set</b></summary>

Drop a markdown file into `quiz-site/sets/`. Press **Reload sets** locally, or push to `main` to update the live site. See [`quiz-site/FORMAT.md`](quiz-site/FORMAT.md) for the format and a prompt that asks Claude to generate one.

</details>

## Helpdesk project

One IT-helpdesk assistant, grown in stages from a single prompt to a governed multi-tool agent. It handles Active Directory accounts, passwords, Microsoft 365 and network/firewall tickets, and shows which design decision each module teaches. Start at the [overview](helpdesk-project/00-README.md).

| # | Stage | # | Stage |
|:-:|---|:-:|---|
| 1 | [Requirements and design](helpdesk-project/01-requirements-and-design.md) | 6 | [Memory design](helpdesk-project/06-memory-design.md) |
| 2 | [Basic prompt](helpdesk-project/02-stage1-basic-prompt.md) | 7 | [Evaluation and testing](helpdesk-project/07-evaluation-and-testing.md) |
| 3 | [Tool-use agent with human-in-the-loop](helpdesk-project/03-stage2-tool-use-agent.md) | 8 | [RPA and automation](helpdesk-project/08-rpa-and-automation.md) |
| 4 | [MCP integration](helpdesk-project/04-mcp-integration.md) | 9 | [Deployment, cost and operations](helpdesk-project/09-deployment-cost-operations.md) |
| 5 | [Security and governance](helpdesk-project/05-security-and-governance.md) | | |

## Repo map

```text
.
├── 00-mso-foundations-notes.md   M1 Foundations + 10-question mini set
├── 01-full-study-notes.md        M2–M5 notes
├── 02-commute-recall.md          recall cards
├── 03-practice-exams.md          Sets A–D with answers and reasoning
├── helpdesk-project/             worked IT-helpdesk assistant, one file per stage
├── quiz-site/                    timed exam site / PWA (server.py, static build, sets/, icons/)
├── prompts/                      prompt used to build the sibling Architect pack
├── assets/                       README pixel art and the script that generates it
└── Developer Exam Prep.md        Obsidian index note
```

The notes are Obsidian-flavoured markdown (`[[wikilinks]]`) but read fine anywhere.

## Disclaimer

Unofficial study material, written from the course modules for personal exam preparation. Not affiliated with or endorsed by Anthropic or Pearson. Confirm version-specific details (model IDs, prices, limits, beta headers) at [platform.claude.com](https://platform.claude.com) before relying on them. The exam site has the [full disclaimer](https://aimanamri.github.io/claude-dev-exam-prep/#disclaimer).

<div align="center">
<sub>Pixel art in <code>assets/</code> is generated by <a href="assets/make_art.py"><code>make_art.py</code></a>. The app icon is a <a href="https://github.com/skulitom/Pixelbolt">Pixelbolt</a> recipe: <a href="quiz-site/og/icon.pixel.json"><code>icon.pixel.json</code></a>.</sub>
</div>
