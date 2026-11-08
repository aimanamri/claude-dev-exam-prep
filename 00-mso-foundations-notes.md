# M1: MSO Foundations: Study Notes

<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/01-full-study-notes|Full study notes]] ➡️
<!-- nav:end -->


The base vocabulary that modules M2–M5 assume. It's a short module, but exam distractors are built from these facts: determinism, temperature, the window "silently truncating", examples as "training data", async vs batch.

Layout per section (same as `01-full-study-notes.md`):
- **MUST REMEMBER**: facts that exam questions are built on
- **SYNTAX**: exact names, parameters and code shapes
- **DEBUG PRIORITY**: what to check first when this area fails
- **TRADE-OFFS & FIXES**: the cost of each option, plus the fix for each failure

Four learning objectives:
1. Tokens, the context window as a fixed budget, sampling, non-determinism (and what it means for testing)
2. The model family and tiers, and how **choosing a model differs from enabling a reasoning mode**
3. Zero-shot vs one-shot vs multi-shot, and the cost/quality trade-off of examples
4. How developers reach Claude: **SDK vs raw REST**, **sync vs streaming**, **async vs batch**

---

## 1.1 Tokens

**MUST REMEMBER**
- Claude reads **tokens**, not characters or words.
- **Characters per token depends on the model's tokenizer and differs between model generations.** Treat any "≈4 chars/token" rule of thumb as model-dependent and confirm it at build time.
- **Everything is counted in tokens**: the prompt, conversation history, **tool definitions**, **tool results**, and the **generated response**.
- Tokens are the unit of **both pricing and context budget**. Think and estimate in tokens, never words.

**TRADE-OFF**: anything you add to a prompt (examples, documents, tool schemas) costs tokens **on every call** and takes up window space.

---

## 1.2 The context window

**MUST REMEMBER**
- The **total tokens the model can take in for one request**: system prompt + full conversation + injected documents + every tool result + **the model's output**.
- It's a **fixed budget** with **two different edge behaviors**:

| Situation | What happens |
|---|---|
| **Input already larger than the window** | **Rejected with a validation error before generation begins** |
| **Input fits, but generation reaches the ceiling** | Current models **stop and return the output so far** with **`stop_reason: model_context_window_exceeded`**; **no error is raised** |

- **The API never silently drops your oldest turns.** Keeping a long session running is **the application's job**: trim or summarize history before each call.
- Development rarely fills the window (short test inputs). Production does (longer inputs, more turns). M2 expands on this.

**DEBUG PRIORITY**
- A session that ran fine in testing fails as inputs grow → **check accumulated history and tool results against the window first.**
- Truncated output with `model_context_window_exceeded` → you hit the ceiling mid-generation. **Fix: trim or summarize history**, not temperature.

**Distractor alert**: "the window expands automatically" ✗ · "oldest turns are silently dropped" ✗ · "temperature is the budget at fault" ✗

---

## 1.3 Sampling

**MUST REMEMBER**
- At each step the model produces a **probability distribution over next tokens and samples from it**. It doesn't pick one fixed token.
- **Temperature** shapes that distribution:
  - **Low**: probability concentrates on the most likely tokens, so output is **more repeatable** (better for classifiers).
  - **High**: probability spreads out, so wording **and even the chosen label** can vary.
- **Temperature 0 is more repeatable but NOT guaranteed identical** across calls.
- **The newest Claude models don't accept non-default sampling parameters.** Setting **`temperature`, `top_p` or `top_k` returns a 400 error**; steer those models **through prompting** instead. Confirm parameter support per model at build time.

**SYNTAX**
```python
# Older / supporting models only: lower temperature for repeatable classification
client.messages.create(model=MODEL, max_tokens=50, temperature=0, messages=[...])
# Newest models: omit temperature / top_p / top_k entirely (sending them → 400)
```

**DEBUG PRIORITY**: a **400 right after adding `temperature`/`top_p`/`top_k`** → the model doesn't support non-default sampling. Remove the parameter and steer through the prompt.

**Distractor alert**: "temperature only affects length" ✗ · "high temperature is more accurate" ✗ · "classification ignores sampling" ✗

---

## 1.4 Non-determinism and testing

**MUST REMEMBER**
- A consequence of sampling: **identical inputs don't guarantee identical outputs**, even when both answers are correct. **Streaming doesn't affect this, and neither does model size.**
- **Don't assert on exact response text**; that makes tests flaky.
- **Assert on properties that must hold**: a required field is present, a value is in range, the structure parses.
- **To judge meaning** (not structure), use an **eval with a model-graded judge**. That's why evals are the course's standard for correctness (built out in M4).

**SYNTAX: property assertions instead of exact text**
```python
data = json.loads(resp.content[0].text)        # structure parses
assert "category" in data                      # required field present
assert data["category"] in {"BILLING", "TECHNICAL", "ESCALATION"}   # value in allowed set
assert 0 <= data["confidence"] <= 1            # value in range
# NOT: assert resp.content[0].text == "BILLING"
```

**DEBUG PRIORITY**: a test that passes sometimes and fails sometimes with the same input → **check whether it asserts exact text.** Rewrite it as a property check or an eval.

---

## 1.5 The model family

**MUST REMEMBER**
- Four tiers: **Fable** (most capable: demanding reasoning, coding, agentic work) > **Opus** (demanding work above Sonnet) > **Sonnet** (**balanced default** for most production) > **Haiku** (speed and cost on tasks that fit its envelope).
- Each tier trades **cost, latency and capability**.
- **Default path**: start with **Sonnet** → move **up** only when an **eval** shows the tier misses your quality bar → move **down to Haiku** only when an **eval** shows the quality drop is acceptable.
- Confirm the lineup and model IDs at **platform.claude.com/docs** at build time.

---

## 1.6 Reasoning modes (separate from model choice)

**MUST REMEMBER**
- **Model choice** = which family member runs. **Reasoning mode** = whether it thinks before answering, **set per call**. They're **independent, composable levers.**
- Extended thinking is **not a different model**, and it's **not fixed per account**.
- Current models use **adaptive thinking**: the model decides when and how much to think, and you tune depth with **effort**, not a fixed token budget.
- **`budget_tokens` is deprecated** and returns a **400** on the newest generations.
- **Thinking content is omitted from responses by default** on the newest models. Request **summarized display** to show it.
- **Per-model defaults differ**: some of the newest models think adaptively by default, or always. Confirm per model.
- Reasoning pays off on **hard, multi-step problems** and is **wasted on lookups and classification**.

**How they combine**

| Combination | Behavior |
|---|---|
| Capable model, reasoning **off** | Fast and direct |
| Smaller model, reasoning **on** | Spends more tokens thinking |
| Capable model + **higher effort** | For the most demanding tasks |

**SYNTAX**
```python
thinking={"type": "adaptive"}     # enable; depth tuned with the effort setting
# budget_tokens=...               # deprecated → 400 on newest models
```

**DEBUG PRIORITY**: a 400 after copying an older thinking example → check for **`budget_tokens`**, and switch to adaptive thinking plus effort.

---

## 1.7 Prompting modes: zero-shot, one-shot, multi-shot

**MUST REMEMBER**
- **Zero-shot**: instruction only, no examples. **One-shot**: one input→output example. **Multi-shot / few-shot**: several examples.
- **Examples are NOT training data.** They sit in the prompt and show the exact shape of the answer. **Nothing is retrained, and nothing carries over to future calls** unless you send the examples again.
- **Each example costs tokens on every call** and takes up context budget.
- Rule: **add the smallest amount of prompt that produces a reliable result.**

**When to use which**

| Situation | Mode |
|---|---|
| Simple task, obvious output shape | **Zero-shot** |
| Specific structure, casing or edge case that a description keeps missing | **One-shot / multi-shot** |
| Zero-shot already correct on a short, well-specified task | **Don't add examples**; they only add token cost for little or no gain |

- **One or two correct examples usually fix a structure problem faster than another paragraph of instructions.**
- **Prompting mode and model choice interact**: a **more capable model often succeeds zero-shot** where a **smaller model needs a few examples**, so **examples can let a cheaper model do the job**. Decide both together: try the simplest model and the fewest examples that pass the eval.

**SYNTAX: one-shot**
```
Classify the ticket into BILLING, TECHNICAL or ESCALATION. Return only the label.
<example_input>My account shows two charges for April.</example_input>
<example_output>BILLING</example_output>
<ticket>{ticket}</ticket>
```

**DEBUG PRIORITY**: wrong **structure** under zero-shot → **add 2–3 correct examples** (not more instruction text, and not a temperature change).

**Distractor alert**: "multi-shot retrains the model permanently" ✗ · "multi-shot lowers cost per call" ✗ · "only temperature changes the output shape" ✗

---

## 1.8 The technical substrate: SDK vs REST

**MUST REMEMBER**
- Claude is reached over an **HTTP REST API**: your code sends a request to an endpoint **with your API key and a JSON body**, and reads a **JSON response** back.
- You can call it with **any HTTP client**, or use an **official SDK** (Python, TypeScript and others): a **thin convenience layer over the same REST API** that handles **auth, request construction, retries and response parsing**.
- **The SDK and raw REST reach the same API and the same model.** The SDK only saves boilerplate. M2 builds on the SDK and the **Messages API**.

**SYNTAX**
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"<model-id>","max_tokens":256,"messages":[{"role":"user","content":"Hello"}]}'
```
```python
from anthropic import Anthropic
client = Anthropic()   # reads ANTHROPIC_API_KEY; adds auth, retries, parsing
resp = client.messages.create(model=MODEL, max_tokens=256,
                              messages=[{"role": "user", "content": "Hello"}])
```
*(The curl headers are standard Messages API usage, shown for reference; the module itself describes REST as "endpoint + API key + JSON body". Confirm the version header at build time.)*

**TRADE-OFF**: raw REST gives full control and works from any language, but you write auth, retries and parsing yourself. The SDK handles those for you; remember it **already retries**, so don't stack your own retry loop on top (M4).

---

## 1.9 Sync vs streaming

**MUST REMEMBER**
- **Synchronous**: send the request, wait, and get the **complete response in one piece**. Good for **short responses and backend jobs where no one is waiting**.
- **Streaming**: the response arrives **in pieces as it's generated**. Output appears immediately (no blank-screen wait), and **your code reassembles** the final message. It's delivered over the **same HTTP connection using server-sent events (SSE)**.
- Streaming improves **perceived** latency. It doesn't change non-determinism or cost. (M2 covers consuming a stream safely and recovering from an interrupted one.)

**SYNTAX**
```python
with client.messages.stream(model=MODEL, max_tokens=1024, messages=msgs) as stream:
    for text in stream.text_stream:
        print(text, end="")
```

**Choose**: a user is watching a long response → **stream**. A short response or a backend job → **sync**.

---

## 1.10 Async patterns for high-volume work (two DIFFERENT patterns)

**MUST REMEMBER**

| | **Async client (async/await)** | **Message Batches API** |
|---|---|---|
| Problem solved | **Concurrency without blocking** your app thread | **Bulk offline** workloads at **lower cost** |
| Latency | **Still real time**; each request returns normally | **Up to 24 h**; submit → get an ID → **poll** |
| Cost | Normal per-token price | **Lower per-token cost** |
| Python | **`AsyncAnthropic`** | `client.messages.batches...` |
| TypeScript | **No separate async class**; the standard `Anthropic` client is **Promise-based**, so you `await` it | Same Batches API |
| Use when | Many concurrent real-time calls (e.g. a web server) | Offline pipelines, eval runs, bulk jobs with **no user waiting** |

**SYNTAX**
```python
from anthropic import AsyncAnthropic
client = AsyncAnthropic()
resp = await client.messages.create(model=MODEL, max_tokens=256, messages=msgs)
```

**DEBUG PRIORITY**: thousands of offline inputs hitting rate limits or tying up the app → you're using a **synchronous loop**. Switch to the **Batches API**. Streaming doesn't help (no one is watching), and neither does a bigger context window.

**Distractor alert**: "TypeScript needs `AsyncAnthropic`" ✗ · "async/await gives the batch discount" ✗ · "fit all 50,000 docs into one request" ✗

---

## Module 1 quiz: answers
1. Two identical prompts must return identical text? → **B**: not necessarily; each next token is **sampled**, so wording can vary even when both answers are correct.
2. Separating model choice from reasoning mode → **C**: model choice picks which family member runs; extended thinking is a **per-call setting** a supporting model can run on or off.
3. Adding three examples to a zero-shot task that already works → **B**: **adds token cost on every call for little or no gain**.
4. Thousands of offline inputs at the lowest cost → **C**: **batch submission with polling**.

## "Predict the behavior" exercise: answers
1. Temperature 0 vs high on a classifier → **A**: low temperature is far more consistent (**never guaranteed**, even at 0); high temperature varies wording and even the label.
2. Zero-shot keeps getting the structure wrong → **B**: 2–3 correct examples show the exact structure; the cost is extra tokens per call, so use the fewest that work.
3. 50,000 docs overnight → **C**: batch and poll for a lower per-token cost. A sync loop hits rate limits; streaming buys nothing.
4. Long session filling the window → **B**: a fixed budget. Oversized input → error before generation; fits but hits the ceiling → truncated output plus `model_context_window_exceeded`. The **app must trim or summarize**.

---

## Five takeaways (the course recap)
1. **Tokens** are the unit of input, output and cost.
2. **The context window** is a fixed budget for the whole request. Oversized input → error; ceiling hit mid-generation → truncated output plus `model_context_window_exceeded`. **Managing history is the app's job.**
3. **Sampling makes output non-deterministic**, so don't test exact text; that's what evals are for.
4. **Model choice and reasoning mode are separate levers.** Use the smallest model, simplest reasoning and fewest examples that pass your eval.
5. **REST API, usually through an SDK.** Pick **sync / streaming / async-await / batch** based on whether a user is waiting and whether the work is real-time or bulk offline.

---

## Commute recall (M1)
- Tokens = everything (prompt, history, tools, results, output) = cost + budget
- Chars per token = **depends on the model**
- Too big for the window → **error before generation**. Hits the ceiling mid-generation → **partial output + `model_context_window_exceeded`**. **Never silent truncation.**
- Sampling → non-deterministic. **Temp 0 ≠ guaranteed identical**
- Newest models: `temperature` / `top_p` / `top_k` → **400**; steer through the prompt
- Test **properties**, not exact text; meaning → **eval + judge**
- Fable > Opus > **Sonnet (default)** > Haiku; move only on **eval evidence**
- Model ≠ thinking. Thinking = **per call**, adaptive + **effort**; `budget_tokens` → **400**; thinking hidden by default
- Zero-shot → simple · few-shot → structure problems · examples ≠ training · each example = tokens every call
- Strong model zero-shot ≈ small model + examples
- SDK = thin layer over REST (auth, retries, parsing)
- Sync = wait for all · Stream = **SSE** pieces · Async = `AsyncAnthropic` (TS: Promise client) · Batch = ≤**24 h**, cheaper, poll

---

## Mini practice set (10 questions; answers below)

**F1.** You set `temperature=0` and run the same classification prompt 100 times. What should you expect?
A. Identical output every time, guaranteed · B. Highly consistent output, but not guaranteed identical · C. Random labels · D. A 400 error on every model

**F2.** A request's input is already larger than the model's context window. What happens?
A. The oldest turns are silently dropped · B. Partial output with `model_context_window_exceeded` · C. A validation error before generation begins · D. The window expands

**F3.** You add `top_p=0.9` to a call against one of the newest Claude models and get a 400. What is the fix?
A. Use `top_p=1.0` · B. Remove the non-default sampling parameter and steer through the prompt · C. Switch to streaming · D. Add `budget_tokens`

**F4.** A unit test asserts `response.text == "BILLING"` and fails intermittently. What is the best fix?
A. Retry the test until it passes · B. Lower `max_tokens` · C. Assert properties (parses, allowed label set), or use an eval · D. Switch to a larger model

**F5.** Which statement about extended thinking is correct?
A. It's a separate model you select · B. It's a per-call setting, tuned with effort on current models · C. It's configured once per account · D. It's controlled by `budget_tokens` on the newest models

**F6.** A cheaper model gets the output structure wrong zero-shot, but a larger model gets it right. What is the cheapest reliable option to try first?
A. Always use the larger model · B. Add 1–3 examples to the cheaper model's prompt and check against the eval · C. Raise the temperature · D. Enable thinking at maximum effort

**F7.** A teammate says multi-shot examples "teach the model permanently". What is the correct reply?
A. True, after the first call · B. True, if you send them 10 times · C. False: they live only in the prompt and must be sent on every call · D. False: examples are ignored

**F8.** A web server makes many concurrent real-time Claude calls in Python and must not block. What should it use?
A. The Message Batches API · B. `AsyncAnthropic` with async/await · C. A synchronous loop · D. A bigger context window

**F9.** In the TypeScript SDK, how do you make non-blocking calls?
A. Import `AsyncAnthropic` · B. Use the standard Promise-based `Anthropic` client and `await` · C. Only through raw REST · D. Through the Batches API

**F10.** What is the relationship between the SDK and the raw REST API?
A. The SDK reaches a different, faster model · B. REST is deprecated · C. Both reach the same API and model; the SDK adds auth, request building, retries and parsing · D. Only the SDK supports streaming

**Answers**
- **F1 B.** Temperature 0 is more repeatable, never guaranteed. (D is wrong because only the newest models reject non-default sampling.)
- **F2 C.** Oversized input fails validation before generation. B is the *fits-but-hits-the-ceiling* case.
- **F3 B.** The newest models reject non-default `temperature`/`top_p`/`top_k`.
- **F4 C.** Non-determinism makes exact-text asserts flaky; assert properties or use an eval.
- **F5 B.** Reasoning mode is separate from model choice, set per call; `budget_tokens` is deprecated and returns 400.
- **F6 B.** Examples can let a cheaper model do the job; choose model and examples together, guided by the eval.
- **F7 C.** Examples aren't training data.
- **F8 B.** Async gives concurrency in real time; batch is for offline bulk work.
- **F9 B.** TypeScript has no separate async class.
- **F10 C.** The SDK is a thin convenience layer over the same REST API.

---
<!-- nav:start -->
> ⬅️ [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · 🏠 [[claude-dev-exam-prep/Developer Exam Prep|Developer index]] · [[Claude Certifications|Home]] · [[claude-dev-exam-prep/01-full-study-notes|Full study notes]] ➡️
<!-- nav:end -->
