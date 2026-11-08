<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/09-deployment-cost-operations|Helpdesk: deployment]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[Claude Certifications|Home]] ➡️
<!-- nav:end -->
I'm preparing for the **Claude Certified Architect – Foundations** exam. Build me a complete study pack from the official prep courses on the Anthropic Partner portal.

## Source (use MY browser)
- Use **Claude in Chrome** (the browser extension, `mcp__claude-in-chrome__*` tools). I'm already signed in to the Anthropic Partner Skilljar portal there. Don't use the built-in browser, and don't ask me for credentials.
- Start page: https://anthropic-partners.skilljar.com/page/claude-certified-architect-foundations-prep-courses
- From that page, list every course/module in the Architect Foundations path (title + URL) and show me the list before extracting. Include the foundational/first module.

## How to extract the content (this worked for the Developer path)
1. Each module page is a SCORM player. The real content is in a nested iframe: `#scorm_content_frame` → an inner iframe whose `src` is a `.../content/wp/.../<Module>.html` file on the same domain. Get that URL with `javascript_tool` (poll for up to ~15 s while it loads), then navigate the tab straight to it.
2. On the content page every screen is a `section.screen`, but only the active one is visible. With `javascript_tool`:
   - mark every element whose computed `display` is `none` (tabs, flip cards, reveal panels) and force it to `display:block !important`;
   - force every `section.screen` visible;
   - split the screens into groups of ≤ 46,000 characters of `innerText`, and expose `window.show(i)` to display one group at a time.
3. Read each group with `get_page_text` (it caps at 50,000 chars). Don't return big strings from `javascript_tool`, because the extension blocks them.
4. Make sure you capture the content of tabbed panels, flip cards, checkpoint questions and every "Reveal model answer" block. If any panel won't render, say which one in the notes.
5. Open one tab for the whole job and close it when you're done.

## Output: folder `~/Documents/Obsidian Vault/claude-architect-exam-prep/`
1. **`00-<first-module>-notes.md`**: a separate file for the foundational module, same structure as file 01 plus a short commute block and a 10-question mini quiz with answers.
2. **`01-full-study-notes.md`**: every section of every module. For each section:
   - **MUST REMEMBER**: facts exam questions are built on
   - **SYNTAX**: exact names, parameters, config files, headers, code or config shapes (only where the course has them)
   - **DEBUG PRIORITY**: what to check first when this area fails
   - **TRADE-OFFS & FIXES**: the cost of each option, plus the fix for each failure

   Also include checkpoint answers per module, a cross-module "symptom → check FIRST / not this" table, and a list of headers, identifiers and numbers to memorize.
3. **`02-commute-recall.md`**: short, phone-friendly cards for every module, plus a numbers flash list.
4. **`03-practice-exams.md`**: four sets, with **all answers and reasoning at the end of the file**:
   - **Sets A and B (standard)**: 30+ scenario questions each, covering every module including the foundational one, in the course style ("worked in dev, broke in prod; pick the targeted fix").
   - **Sets C and D (advanced, certification style)**: 30 each, harder. Use long scenarios with irrelevant detail, two or more plausible answers, FIRST/BEST/MOST/LEAST/NOT stems, "Choose TWO" items, and ordering items.
   - Spread the answer letters evenly across A–D. Each answer's reasoning explains why the closest wrong option fails.
   - Add a score guide.

## Style rules
- Write neutrally: state the correct rules and syntax. Don't frame anything as correcting my input.
- Keep code and config **valid**, with straight quotes and correct nesting. For Claude API syntax, check it against the `claude-api` skill rather than memory, and flag anything that changed since the course was written (e.g. sampling parameters, forced `tool_choice`, `budget_tokens`, model IDs).
- Mark version-pinned facts (prices, model IDs, limits, beta headers) as "confirm at build time."
- Quote sparingly: summarize in your own words, never reproduce whole course passages.
- Use a task list while you work, and tell me at the end which panels (if any) didn't render.

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/helpdesk-project/09-deployment-cost-operations|Helpdesk: deployment]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[Claude Certifications|Home]] ➡️
<!-- nav:end -->
