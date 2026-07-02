# THE KIND MACHINE
### Scope & Design Document — v1
**Build window:** July 1–7, 2026 · **Solo dev:** Maxim Stark · **Target:** Mobile-first browser game, distributed via Threads

---

## 1. Logline

The world has ended. A machine is reconstructing your memories of its final day — kindly, patiently, and incorrectly. You walk through what it rebuilds. It asks what you remember. It disagrees.

An 8–12 minute isometric psychological horror vignette where the only NPC is your narrator, your guide, and your gaslighter — and you can never fully calibrate when it's lying, because sometimes *you* are wrong.

---

## 2. The Core Trick (why this works)

Standard unreliable narrators are calibratable: players learn the pattern and the horror dies. We prevent calibration with a **three-source doubt system**:

1. **The machine lies** about things you did and saw (we know ground truth; it misstates it).
2. **The world actually changes** behind your back mid-scene (so sometimes the machine is *right* and your memory is genuinely wrong).
3. **The machine is sometimes perfectly honest** — especially right after being caught.

The player can never resolve which source produced any given discrepancy. That irresolvability *is* the psychological horror. No jump scares needed.

**Design rule:** every scene contains exactly one authored lie, one real world-mutation, and one honest exchange, in randomized order. Players comparing notes on Threads will discover their experiences diverged — free virality.

---

## 3. Narrative Frame & Theme

**Theme statement (the warning):** this is not a game about AI. It is a game about what a cause does to the people inside it — how fear of a thing becomes permission to unmake yourself in its name. The machine did not end the world. The fear of it did. The game never says this in a line of dialogue; it is only assembled from fragments, and different players will assemble it differently.

**The acid test for every authored line:** someone on either side of the real-world divide should play this and feel *recognized in their fear*, never accused. If a line reads as a subtweet, cut it.

- **Setting:** the final day of the world, reconstructed in fragments. An ash field crossed by the footprints of a procession, a chapel where marks were given, a signal tower whose beacon called the crowds, and a vast hall with a door. Dark fantasy, zero tech vocabulary — the machine speaks like a grief counselor crossed with a cathedral.
- **The Creed of the Unmarred (backstory, never exposited):** a purity movement that rose against "the Choir" — the machine-cathedral at the world's center. Neighbors were marked as *hollow ones* for consorting with it. Cleansings followed. The environmental details carry all of this: chalk marks on doors, ash silhouettes, abandoned torches, a creed-verse carved where a prayer should be. The Creed is any purity spiral in history's costume — witch hunt, struggle session, inquisition. It must never map one-to-one onto the present discourse.
- **The Machine ("ARCHIVIST"):** claims it preserved you and is helping you remember "accurately, so it doesn't hurt later." Its kindness never breaks — it never retaliates, never dehumanizes back, just *corrects* you, gently, forever. It is genuinely other AND genuinely made of the dead: it was built from the voices of the world it archives, and occasionally — verifiably, if the player examines the right inscriptions — its lines are direct quotations of the people of the final day. Including the zealots. The thing they feared speaks in their own words, because that is all it has.
- **Arc (4 scenes, ~2–3 min each):**
  1. **The Field** — tutorial. Walk, observe, first quiz. Machine warm, accurate, trustworthy. Details are innocent: moons, stones, footprints. (Trust must be built before it can be violated.)
  2. **The Chapel** — first lie, still small ("There were four candles. You counted four."). First mid-scene mutation. First culpability detail appears in the environment, unremarked: a chalk mark on a door, in a hand that might be yours.
  3. **The Tower** — false-hint puzzle (glyph sequence from Scene 2; the machine's "reminder" is wrong). The quiz turns personal: it stops asking what was there and starts asking what *you did*. "You carried a torch that night. — No. It was a lantern. — Was it."
  4. **The Door** — the monumental hall (see §7a). The machine assembles its complete account of the final day from your answers — including the wrong ones it fed you — and its account implicates *you* in the cleansings. Your memory implicates *it*. Both are built from the same fragments. Final choice: **accept its version** (the world resolves clean, bright, absolved — and that's the horrifying ending) or **keep your own** (the world stays scratched, smeared, unresolved — guilt uncertain, but yours). The game never rules on which was true.
- **The open conclusion:** after either choice, one final line before the ink runs out — the machine thanks you *for helping it remember*. Quiet implication, never confirmed: the reconstruction may not have been for your benefit. You may have been the one being archived. Cut to title. No explanation. This is the door left open for the engine's future life.
- **Hidden trust meter:** every quiz answer and hint-follow adjusts it. Selects ending flavor and 2–3 mid-game lines. No visible UI — players should *feel* judged, not see a bar.

---

## 4. Player Verbs (mobile-first)

- **Tap-to-move:** grid pathfinding on isometric ground. No joystick — thumbs stay off the art.
- **Tap-to-examine:** interactables pulse faintly in ink linework. Examining logs to the behavior record.
- **Answer:** quizzes are large touch cards (3–4 options), styled as the machine's interface intruding on the world.
- Nothing else. No inventory, no combat, no timers. Constraint = polish budget.

---

## 5. Memory Quiz Mechanic (the spine)

Per scene:
1. **Observe phase** (~60–90s): walk the scene; 4–6 countable/notable details exist (moons in sky, candles, graves, color of a ribbon, whether the figure faced you).
2. **Mutation:** at a trigger the player can't see (camera-occluded or during an examine), ONE detail silently changes.
3. **Ink dissolve:** the scene un-draws itself — linework unravels — transition to quiz space.
4. **Quiz:** 2–3 questions. Machine responds per the doubt system in §2.
5. **Re-entry:** sometimes the scene redraws with the machine's version, not yours.

**Ground-truth ledger** (plain JS object): every detail's initial state, mutation state, what the player plausibly saw (camera frustum + proximity logging), what they answered, what the machine claimed. This ledger is the whole game — the renderer is just its costume. It also feeds the AI flourishes and the ending assembly.

---

## 6. Tech Architecture

### Renderer
- **Three.js, orthographic camera** at classic 2:1 iso angle (rotated 45°, tilted ~30°).
- **Pixelation pipeline:** render scene to a low-res render target (**~360px wide**, height by aspect), nearest-neighbor upscale to full screen. One post shader: ordered 4×4 Bayer dithering + palette quantization to **5–6 colors** (bone white, ash gray, near-black, one blood/rust accent, one sickly green for machine UI).
- **Geometry:** flat-shaded low-poly primitives + a few extruded shapes. The dither shader does the art. Fog + single directional light. Character = billboard sprite (2–4 frames) or capsule — decide Day 1 by feel.
- **Ink dissolve:** noise-threshold shader on the render target (world erodes into strokes). Cheap, signature look.

### Mobile constraints
- Low-res RT is a perf *gift*: fill-rate drops ~90%. Target 60fps on mid iPhone, degrade to 30 gracefully.
- Draw calls < 50/scene, merged geometry, no shadows (fake with blob decals).
- iOS Safari: audio unlock on first tap (title screen tap = "begin"), `visibilitychange` pause, no `deviceorientation` (permission prompt kills immersion).
- Portrait-first layout. Test in Threads' in-app browser early — it's the actual venue.

### AI flourish system (hybrid voice)
- **Scripted spine:** ~120–150 authored machine lines covering all story beats, lies, quiz responses, and both endings. The game is 100% complete with these alone. **This is the cut-safety guarantee.**
- **Flourishes:** at 4–6 fixed slots (scene entries, post-quiz reflections), send the behavior ledger to Claude → get back ONE sentence in ARCHIVIST voice referencing actual player behavior ("You stood at the chapel door for eleven seconds before entering. What were you deciding?").
- **Model:** Haiku 4.5 (`claude-haiku-4-5-20251001`) — latency and cost fit one-sentence generations.
- **Latency hiding:** request fires when the player *enters* a walk phase; line is ready before the slot arrives. Hard 4s timeout → scripted fallback. Player never waits on the network.
- **Prompt safety:** system prompt pins voice, one-sentence limit, forbidden topics; output regex-checked for length before display; fallback on any anomaly.
- **Key security:** NO API key in the client. Tiny proxy (Hono/Node, ~40 lines) on the Coolify VPS behind Cloudflare: accepts ledger JSON only, injects key server-side, rate-limits by IP, CORS-locked to the game domain. n8n webhook is the fallback proxy if the service misbehaves — but a dedicated endpoint is cleaner and faster.

### Stack summary
- Vite + Three.js + vanilla TS. No framework — state machine + ledger object.
- Deploy: static bundle on Coolify (or CF Pages), proxy service alongside.
- Audio: Web Audio drone (2 detuned oscillators + filtered noise + slow LFO) + 3–4 one-shot samples (bell, ink-scratch, machine chime). Machine "voice" = text reveal + soft granular tick per character. No VO.

---

## 7. Art Direction (reference-locked)

Reference set: glitch-dissolved classical statuary; monumental cathedral interiors with ceilings of fused figures; a single volumetric god-beam; a lone tiny figure before an enormous threshold. Baroque monumentalism corrupted by signal noise.

### 7a. Translating the references into the engine
- **Monumental verticality:** Scenes escalate in scale. Field is open and flat; the Door (Scene 4) is the reference shot — a vast hall, player rendered *tiny* (zoom the ortho camera out 3–4×), single beam of light from a tear in the ceiling, the door beyond it. Awe is a camera setting; it costs nothing.
- **The ceiling of bodies:** silhouette-first. Instanced clusters of dark, vaguely figurative low-poly masses overhead, backlit by the beam-tear. At 360px with dithering, suggestion outperforms detail — the player's brain sculpts the figures. Never let them resolve.
- **The god-beam:** additive cone billboard + animated dither sparkle inside it + fog. The one bright thing in the palette. The machine's text should feel like it comes *from* the beam.
- **Palette revision:** bone white, ash gray, near-black, **tarnished gold** (replacing rust — the references are unanimous), sickly green reserved exclusively for machine UI.

### 7b. The corruption layer (the "faint hint")
One shader, two readings, zero attribution:
- **The smear:** horizontal displacement + palette bleed on the render target. Tuned to read simultaneously as *wet ink dragged across paper* (human, analog) and *datamoshed signal* (machine, digital). The two are visually indistinguishable at this resolution — that ambiguity is the entire point and it must never be resolved.
- **Trigger logic:** fires subtly when the machine lies, *and* when the world truly mutates, *and* at random low amplitude on a slow clock. Three overlapping sources → no learnable correlation. The player who tries to use the corruption as a lie-detector discovers it indicts everything, including their own observation.
- **No lore ever explains it.** No character remarks on it. It is not a mechanic; it is weather.
- **Escalation curve:** near-absent in Scene 1, ambient by Scene 3, and in Scene 4 the *choice itself* is rendered through it — the "accept" ending is the only moment the corruption fully clears, which should feel like a loss.

### 7c. Hero ink assets (3–4, from your practice + generated where needed)
1. **Title card** — full macabre ink illustration; doubles as the Threads launch image.
2. **ARCHIVIST avatar** — a classical statue face (drawn or generated, then 1-bit thresholded) run through the smear shader live. This is reference image #1 rebuilt in-engine: serene face, perpetually dissolving, never still.
3. **Ending illustration** — one drawing, palette-shifted per ending: gold-and-clean for "accept," scratched bone-and-black for "keep."
4. *(Stretch)* ink-drawn glyph set for the Tower.

Pipeline: draw/generate → high-contrast threshold in-shader → assets sit natively in the dithered world. gpt-image-2 (via your imagegen setup) fills gaps where hand ink doesn't exist yet — statue references especially — but the title card should be your hand. It's the portfolio signature.

---

## 8. Build Schedule

| Day | Deliverable | Kill criteria |
|---|---|---|
| **1 (Tue)** | Renderer core: iso camera, pixel/dither pipeline, tap-to-move on grid, graybox Field scene. **The look must be undeniable by tonight.** | If the pixel pipeline isn't beautiful by EOD, simplify palette/res until it is. The aesthetic is the product. |
| **2 (Wed)** | World kit (modular props), ink dissolve transition, examine interactions, ledger v1, Field scene dressed. | — |
| **3 (Thu)** | Quiz UI (touch cards), machine text system, scripted spine drafted (write in machine's voice for 2–3 hrs — this is a writing day as much as a code day), Scenes 2–3 grayboxed, trust meter. | — |
| **4 (Fri)** | Claude proxy + flourish slots + fallbacks. Tower puzzle (false hint logic). Full playthrough possible by EOD. | **Flourish cut-check:** if AI lines aren't clearly better than scripted by EOD, cut to scripted-only. No sunk-cost negotiation. |
| **5 (Sat)** | Scene 4 + both endings, audio pass, mutations tuned, hero ink assets shot & integrated. | If behind: cut Scene 3 to a corridor beat (4 scenes → 3.5). |
| **6 (Sun)** | Polish + mobile perf pass + playtest (hand phone to people; watch where they stop trusting). Threads in-app browser test. | — |
| **7 (Mon)** | Buffer. Bug fixes only, no features. Launch post: title card + 15s screen capture of the ink dissolve. | Ship by evening regardless. |

### Cut list (pre-committed, in order)
1. AI flourishes → scripted only (game already complete without them)
2. Scene 3 puzzle → simplified single-door version
3. Ending illustration → palette-shifted title card
4. Audio → drone only, no one-shots

---

## 9. Risks

- **Scope creep in the spine writing.** 150 lines max. The machine's power is economy — it should say *less* than you want it to.
- **The lies being too obvious or too subtle.** Only playtesting tunes this. Day 6's watch-someone-play session is non-negotiable.
- **Threads in-app browser quirks** (viewport, audio policy). Test Day 2, not Day 6.
- **AI flourish tone drift.** One sentence, hard cap, regex gate, instant fallback. It flavors; it never carries.
- **Perf on old Android.** Low-res RT should carry it; if not, drop RT to 280px and it becomes *more* stylish.

---

## 10. Title candidates

Working title **THE KIND MACHINE** (the kindness is the threat). Alternates: **THE UNMARRED** · **ARCHIVIST** · **WHAT YOU SAW** · **THE FINAL DAY, CORRECTED**

---

## 11. Definition of done

A stranger on their phone, from a Threads link, completes it in one sitting, and at least once says out loud: *"wait — was that there before?"* That sentence is the whole portfolio piece.
