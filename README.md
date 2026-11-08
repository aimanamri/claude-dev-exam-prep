# Claude Certified Developer – Foundations (CCDV-F) exam prep

Study notes, practice exams and a local timed exam site for the **Claude Certified Developer – Foundations** certification.

## Contents
| Path | What's in it |
|---|---|
| `00-mso-foundations-notes.md` | M1 Foundations notes, plus a 10-question mini set |
| `01-full-study-notes.md` | M2–M5 notes: must-remember facts, syntax, debug priority, trade-offs |
| `02-commute-recall.md` | Short recall cards |
| `03-practice-exams.md` | Practice Sets A–D with answers and reasoning |
| `helpdesk-project/` | Worked IT-helpdesk assistant project that applies each module |
| `quiz-site/` | Local, timed practice-exam site for every set |

The notes are Obsidian-flavoured markdown (`[[wikilinks]]`), but they read fine anywhere.

## Practice exam site
```bash
cd quiz-site
python3 server.py --open      # http://localhost:8765, Python 3 only, no dependencies
```
- Sets A–D, the M1 mini set, mock Sets E–H (40 Q / 60 min) and a shuffled Must-Remember drill (293 questions)
- Pearson-style screen: timer, pause/resume, flag for review, review grid, strike-out
- Exam mode (answers at the end) or Practice mode (check each answer as you go)
- Score report with per-module breakdown, reasoning for every answer, and "retry missed"
- Progress and history are kept in your browser's localStorage

Add a set by dropping a markdown file into `quiz-site/sets/` and pressing **Reload sets**. See [`quiz-site/FORMAT.md`](quiz-site/FORMAT.md) for the format and a prompt that asks Claude to generate one.

## Disclaimer
Unofficial study material, written from the course modules for personal exam preparation. Confirm version-specific details (model IDs, prices, limits, beta headers) at platform.claude.com before relying on them.
