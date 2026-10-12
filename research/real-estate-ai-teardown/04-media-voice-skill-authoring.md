# Teardown D — Media, Voice, and Skill-Authoring Tooling

**Repos analyzed (read-only, nothing executed):**

| # | Repo | Author / org | License | One-liner |
|---|------|--------------|---------|-----------|
| 1 | `re-walkthrough-pro` | Charles J Dove (charlieautomates.com), 1 commit 2026-07-23 | MIT | Claude Code skill: Zillow listing → Apify photo scrape → Higgsfield per-room image-to-video → ffmpeg stitch → "cinematic walkthrough" to sell to agents |
| 2 | `sofia-voice-agent` | Santiago Muñoz Ibarra (Horizontes IA, Mexico), 1 commit 2026-04-12 | **No LICENSE file** (README calls it "free code"; legally all-rights-reserved by default) | Spanish-language inbound/outbound AI voice receptionist for a CDMX real-estate agency: Retell + Modal + Twilio + Notion CRM + Cal.com + Claude post-call scoring + Next.js dashboard |
| 3 | `skills-for-architects` ("Arch Studio", plugin `as` v1.5.1.2) | Federico Negro / ALPA (Alpaca Design Lab LLC), squashed commit 2026-10-05 | MIT | 61-skill governed Claude Code + Codex plugin for architecture firms; in scope here: `skill-maker`, `demographics-analysis`, root README, PATTERNS/CONTRIBUTING/rules conventions |

Reader: a Redfin | Powered by Rocket sales manager in Los Angeles coaching ~30 agents, with Higgsfield, Gmail, Slack, Google Drive, Docusign and Gamma connectors. All "steal this" sections are written for that reader.

---

## 1. `re-walkthrough-pro`

### 1.1 Identity
- **Name:** RE Walkthrough Pro (npm `re-walkthrough-pro` v0.1.0; `SKILL.md` says v0.2.0)
- **Author:** Charles J Dove, part of a "Charlie OS / UGC Factory / Higgsfield Earning Series" product family. README carries Higgsfield affiliate and Apify referral links.
- **License:** MIT
- **Purpose:** "Turn a Zillow listing into a cinematic, room-by-room walkthrough video — right inside Claude Code. Apify pulls the photos, Higgsfield animates each room, ffmpeg stitches the final cut. Built to sell to real estate agents."

### 1.2 Architecture
**Layout (7 markdown files + a Node installer, zero runtime code):**
```
bin/re-walkthrough-pro.js        # copies skill/ → ~/.claude/skills/re-walkthrough-pro/ (or ./.claude/skills with --project)
skill/SKILL.md                   # activation, persona, hard rules, routing table
skill/tasks/build-walkthrough.md # the interview + 8-step pipeline
skill/frameworks/apify-zillow-actors.md
skill/frameworks/higgsfield-camera-moves.md
skill/frameworks/stitch-pipeline.md
skill/templates/property-md.md
skill/checklists/walkthrough-quality.md
```
The installer is a plain recursive file copy with `install | update | uninstall | where` commands. Everything else is instructions Claude Code follows.

**Pipeline stages (README's 6 / task file's 8):**
```
1. RESOLVE   Zillow link → Apify detail scraper (photos + address + specs)
             "find 5 in NJ" → search actor → detail scraper (chained dataset)
2. PERSIST   write PROPERTY.md, download all photos to source-images/
3. CURATE    vision pass: best photo per room, drop floorplans/dupes, tag room type
4. ANIMATE   per room → Higgsfield image-to-video with a room-matched camera move
5. STITCH    ffmpeg concat in walkthrough order → 16:9 master (+ optional 9:16)
6. DELIVER   final video + per-room scenes + PROPERTY.md, in one folder
```

**External services, cost, credentials:**

| Service | Role | Cost / key |
|---|---|---|
| Apify MCP (`@apify/actors-mcp-server`) | Zillow scrape: `maxcopell/zillow-detail-scraper` (primary, photos+specs+agent), `maxcopell/zillow-scraper` and `maxcopell/zillow-zip-search` (discovery), `burbn/zillow-property-images-scraper` (fallback hi-res to 1536px) | Apify token from console.apify.com; PAY_PER_EVENT "~$0.0036/result detail, ~$0.0023/result search" |
| Higgsfield MCP | `generate_video` image-to-video (Seedance 2.0 default, Kling 3.0 option), `reframe` for 9:16, `models_explore`, `job_status` polling | Higgsfield credits; "the room count (curation) is the real cost lever" |
| ffmpeg (local) | normalize + concat + fallback crop | free |
| Optional sibling skills `seedance-real-estate`, `seedance-cinematic` | supply the actual camera-move prompt wording and film-look layer | shipped in the author's paid **UGC Factory** package |

**How Claude is invoked:** as a Claude Code slash skill `/re-walkthrough-pro`. `SKILL.md` frontmatter: `name, type: standalone, version, category: content, description, repository, allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]`. Body uses pseudo-XML sections `<activation>`, `<persona>`, `<hard-rules>`, `<commands>`, `<routing>`, `<greeting>`. Routing is progressive disclosure: "Load on Command" `@tasks/build-walkthrough.md`; "Load on Demand" each framework/template/checklist when its step runs. Claude does the vision curation itself by `Read`-ing images.

### 1.3 Mechanics (step by step)

**Step 0 — activation / not-for list** (worth copying verbatim as a pattern):
```
## Not For
- True 3D / Matterport reconstruction — Higgsfield does cinematic camera moves on photos, not spatial reconstruction
- Other portals (Realtor.com, Redfin) — Zillow only in v1
- Agent outreach / sending the video — this skill produces the asset, not the pitch
- Music or voiceover — v1 ships a silent master; add sound in your editor
```

**Hard rules (every run):**
```
1. Pulled photos must have NO on-screen text. Any source photo with a baked-in watermark, agent name/headshot
   badge, price banner, "Coming Soon"/"For Sale"/"Just Listed" overlay, MLS stamp, logo, or tour-company bug
   is unusable — delete it from source-images/ during curation, never animate it ...
2. Always ask if they like the output. After delivery, ask "Do you like the walkthrough?" If not, have them
   name the room in scenes/ they didn't like, regenerate only that scene, rebuild the master, and drop the
   new master in final/. Repeat until approved.
```

**Step 1 `choose_input_mode`:** URL / address / discovery ("find 5 single-family homes in Montclair NJ" → table of address · price · beds/baths · sqft · photo count → user picks). Confirms `propertyStatus` (FOR_SALE / RECENTLY_SOLD / FOR_RENT).

**Step 2 `collect_creative_choices`** — a 4-question interview with defaults and a one-word "go":
```
1. Style — Cinematic (camera-move per room) [default] or Basic (simple slow pan / Ken-Burns).
2. Rooms — Auto-curate ~6–10 hero shots [default] or animate all photos.
3. Output ratio — 16:9 master for agent delivery [default], 9:16 social cut, or both.
4. Engine — Seedance 2.0 [default] or Kling 3.0.
State the rough cost before running: detail scrape (~$0.004) + N Higgsfield clips. Confirm to proceed.
```

**Step 3 `resolve_listing`** — Apify `call-actor` with `startUrls` or `addresses`; chain discovery via `searchResultsDatasetId`. Verify address, price, beds/baths/sqft, year, agent, non-empty image list. Slug = kebab-case address.

**Step 4 `persist_property`** — folder tree + `PROPERTY.md` (template below).

**Step 5 `curate_rooms`** — text screen first (rm texted photos, log in PROPERTY.md), then vision pass: "pick the single best photo per distinct room, drop floorplans, maps, aerial-only, and near-duplicate shots. Target the hero set: exterior, entry/foyer, living, kitchen, primary bed, primary bath, one secondary bed, and a backyard/outdoor shot when present (~6–10 total)." Fixed tour order regardless of Zillow order:
```
exterior → entry/foyer → living → dining → kitchen → bedrooms → bathrooms → outdoor/backyard
```

**Step 6 `animate_rooms`** — Room → camera-move vocabulary (the most reusable artifact in the repo):

| Room / shot | Named move | Note for image-to-video |
|---|---|---|
| Exterior / establishing | DRONE AERIAL APPROACH (or GIMBAL GLIDE along facade) | slow approach toward entry; compress to ~5s |
| Entry / foyer | DOORWAY THRESHOLD REVEAL → STEADICAM WALKTHROUGH | "walking in" feel |
| Hallway | STEADICAM WALKTHROUGH | human walking pace, smooth |
| Living / great room | ROTATING/ORBIT or GIMBAL SMOOTH GLIDE | reveal space + depth |
| Kitchen | GIMBAL SMOOTH GLIDE (counter flow) or ORBIT (island) | highlight finishes |
| Dining | GIMBAL SMOOTH GLIDE (table approach) | warm, steady |
| Primary bedroom | STEADICAM / gentle GIMBAL GLIDE | calm, spacious |
| Primary bath / spa | DOORWAY THRESHOLD REVEAL → short push-in | bright, clean |
| Secondary bedroom | GIMBAL SMOOTH GLIDE | brief beat |
| Guest bathroom | REVEAL AROUND CORNER / short push-in | quick, don't linger |
| Home office / library | PULLBACK OR PUSH-IN REVEAL | detail → context |
| Specialty (gym, cinema, wine) | PULLBACK/PUSH-IN or ORBIT | feature the wow |
| Window / view feature | WINDOW APPROACH & VIEW REVEAL | the emotional beat |
| Soaring ceiling / 2-story foyer | CEILING-TO-FLOOR VERTICAL TILT | reveal height |
| Outdoor / backyard / pool | DRONE AERIAL APPROACH or LATERAL CRANE | rising reveal closer |
| Detail (marble, fixtures, joinery) | PULLBACK/PUSH-IN REVEAL + SUBTLE FOCUS SHIFT | craftsmanship |

Prompting rules (verbatim, short):
```
- One move per clip. Compound moves warp geometry. Single and slow.
- Slow beats fast. Real estate reads premium when calm; fast moves expose AI artifacts (melting furniture, bent doorways).
- Prompt the camera + light, not the scene. The photo carries content.
- Engine is independent of the prompt craft. ... Optionally models_explore(action:'recommend') per shot.
- Aspect ratio = master ratio. Generate at 16:9 for the agent master (or 9:16 if that's the only output). Reframe later; never generate twice.
```
Image-to-video adaptation: "Do NOT re-describe the room's contents in the prompt — that fights the input image and drifts content. Prompt the camera + light, trust the photo." Dispatch all rooms, then poll; download to `scenes/room-NN-{type}.mp4`.

Bad-output table:
```
| Furniture melts / warps        | Regenerate with a gentler, shorter move (orbit → short push-in)        |
| Doorway / window bends         | Reduce move distance; prefer lateral glide over push-in for that room  |
| Clip too short to feel cinematic | Accept it — stitched short clips still read as a tour                |
| One room keeps failing         | Note it, skip after one retry; never block the property on one room    |
```

**Step 7 `stitch_and_reframe`** — the ffmpeg commands (verbatim, reusable as-is):
```bash
# 1. Normalize every scene to 1080p, 30fps, h264 (master = 16:9)
for f in scenes/room-*.mp4; do
  ffmpeg -y -i "$f" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
    -c:v libx264 -pix_fmt yuv420p -an "norm-$(basename "$f")"
done
# 2. Concat in sorted (walkthrough) order
ls norm-room-*.mp4 | sort | sed "s/^/file '/;s/$/'/" > concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c:v libx264 -pix_fmt yuv420p -an final/walkthrough-16x9.mp4
# 9:16 fallback (prefer Higgsfield reframe)
ffmpeg -y -i final/walkthrough-16x9.mp4 -vf "scale=-1:1920,crop=1080:1920" -c:v libx264 -pix_fmt yuv420p -an final/walkthrough-9x16.mp4
# verify
ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 final/walkthrough-16x9.mp4
```
Rules: hard cuts default; `xfade` only 0.3–0.5s if asked; silent master; "Duration ≈ sum of scene durations (catches a silently dropped clip)"; "Regenerating rooms at 9:16 for the social cut = double Higgsfield spend → reframe the finished master."

**Step 8 `review_and_deliver`** — report paths, scene count, skipped rooms, rough credit + Apify spend; mandatory approval loop with scene-level regeneration.

**Quality checklist** (`checklists/walkthrough-quality.md`) — grouped Assets & Structure / Video Output / Visual Quality / Truth-in-Claims / Approval, with a scoring rubric:
```
| 100%     | Ship it       | Deliverable to the agent                                   |
| 80-99%   | Fix and ship  | Regenerate the offending room(s), then go                  |
| 50-79%   | Rework        | Several bad clips or wrong order — rebuild scenes          |
| Below 50%| Restart       | Bad source set or wrong listing — re-scrape                |
```
Truth-in-claims items: "Asset is described as a 'cinematic walkthrough,' not '3D' or 'Matterport'"; "Master is silent (v1)."

**PROPERTY.md template** — per-property brief: specs table, agent, photo counts, Shot List table `(# | Room | Photo | Camera move)` as audit trail ("Row count equals scenes/ clip count"), Build Choices (style/rooms/ratio/engine for reproducibility), Outputs, Run Notes.

### 1.4 Compliance posture
- **Photo rights (the big one):** the whole premise is scraping *other brokerages'* Zillow listing photos and selling derivative videos back to agents. Listing photos are typically copyrighted by the photographer/brokerage and licensed to the MLS under rules that forbid reuse by other parties. The hard rule to *delete watermarked photos* is a quality rule that doubles as attribution-stripping. For a Redfin manager this risk largely disappears if the skill is pointed only at Redfin's own listings' photos (Redfin-commissioned photography) — verify the photographer agreement grants derivative/marketing rights.
- **Zillow ToS:** Apify actors exist precisely because "Zillow blocks naive fetch/headless." That is a ToS workaround, not a license.
- **Advertising truthfulness:** good instinct — "Honest framing: cinematic walkthrough, not 3D/Matterport"; "never promise a walkable dollhouse." But AI motion can hallucinate geometry (bent doorways, melted furniture) and the skill only screens for *obvious* warping. California B&P misleading-advertising rules and MLS virtual-staging disclosure norms suggest a "video contains AI-generated motion from still photos" disclosure in captions.
- **Fair Housing:** no copy/captions are generated, so low direct risk; nothing stops a user from adding problematic captions later. No guardrail.
- **Data handling:** stores listing-agent name/phone/email in PROPERTY.md; no PII of consumers. Nothing sent anywhere except Apify/Higgsfield.
- **Supply chain:** `npx` installer copies markdown into `~/.claude/skills/`; benign in this version, but it is an arbitrary-file-copy pattern you re-run on every `update`.

### 1.5 Best ideas to steal (for LA Redfin manager with Higgsfield connector)
1. **Room → camera-move mapping + "prompt the camera and light, not the scene."** Directly usable with the Higgsfield MCP you already have (`generate_video` / `generate_video_batch`, `jobs_wait`, `reframe`, `models_explore`). Note: this repo polls `job_status`; your connector exposes `jobs_wait` and `show_generation_by_ids` instead.
2. **Cost gate before generation** ("auto-curate ~6–10 hero rooms", "state the rough cost before running"). Credits are the real cost; curation is the lever.
3. **One slow move per ~5s clip; stitch on your side; hard cuts; reframe once instead of regenerating.**
4. **Normalize-before-concat + duration≈sum sanity check** — the two ffmpeg bugs everyone hits.
5. **Scene-level approval loop** — regenerate one room, not the whole tour.
6. **Predictable per-asset folder + PROPERTY.md shot list** = reproducibility and a hand-off doc for the agent.
7. **Checklist with a scoring rubric and a "Truth-in-Claims" section.**
8. **"Not For" block** in the skill header — stops the skill triggering on adjacent requests.
9. **Text-screen rule** — adapt as: *only Redfin-owned photos; no third-party watermarks; add our own branded end card instead.*

### 1.6 Weaknesses / hollow or risky
- The camera library is **names only** ("GIMBAL SMOOTH GLIDE") — the actual motion-prompt wording lives in the author's paid `seedance-real-estate` skill. Without it Claude improvises.
- Zillow-only, scraping-dependent, IP-risky business model; actor IDs "current as of 2026-06-27" will rot.
- Silent, unbranded output: no price/address title card, no agent end card, no captions, no CTA, no music — i.e., not actually postable for a Redfin agent without an editor.
- No audio, no voiceover, no still-photo fallback when a room keeps failing.
- Vision curation by Claude on 30–60 images per listing is token-heavy and nondeterministic.
- "Discovery" path ("find 5 in NJ") is a lead-gen feature for a freelancer, irrelevant for an in-house team.
- Marketing-heavy README ("Earning Series", affiliate links); single commit; no tests beyond `--version`.

---

## 2. `sofia-voice-agent`

### 2.1 Identity
- **Name:** Sofía — Agente de Voz IA para Inmobiliarias (pyproject `agente-de-voz-sofia` 0.1.0; `/health` reports 0.2.0)
- **Author:** Santiago Muñoz Ibarra, Horizontes IA (YouTube course; README pitches "learn to sell this system to businesses for $2,500+ USD"). Language: Spanish (Mexico); business: fictional "Inmobiliaria Horizontes", CDMX.
- **License:** none in repo.
- **Purpose:** "Sofía contesta llamadas, busca propiedades, registra leads, agenda visitas y genera resúmenes automáticos con IA — todo sin intervención humana."

### 2.2 Architecture
```
app/main.py               Modal app + FastAPI: 9 endpoints, hourly cron
app/config.py             env loading (.env locally; Modal secret "sofia-credentials" in prod)
app/outbound_worker.py    run_outbound_cycle(): pending leads → Retell outbound calls
app/services/             notion_service (CRM), retell_service, twilio_service (send_sms only), calcom_service, anthropic_service
app/webhooks/             retell_handler (call_started/ended/analyzed → post-call pipeline), twilio_handler (stub)
scripts/create_retell_agent.py      inbound agent: SYSTEM PROMPT + 5 tools + voice config
scripts/create_outbound_agent.py    outbound agent: prompt with {{dynamic_variables}} + 4 tools
scripts/test_functions.py           smoke tests against LIVE APIs (creates real Notion rows)
dashboard/                Next.js 15 + shadcn; reads Notion + Retell; PATCHes the live prompt
BRIEF_MEGA_SISTEMA.md     product brief for a paid multi-industry template (sofia.config.yaml, /setup skill, 8 industry prompt packs)
```
**Call flow:** `Caller → Twilio number (SIP trunk) → Retell (STT + LLM "claude-4.5-sonnet" + Cartesia TTS) → Retell custom tools POST to Modal endpoints → Notion/Cal.com`. On `call_ended` webhook → Modal fetches transcript from Retell → Claude `claude-sonnet-4-5` JSON analysis → Notion call record + lead upsert. Hourly `modal.Cron("0 * * * *")` → `get_pending_leads()` → outbound call per lead with dynamic variables.

**Endpoints (`app/main.py`):** `GET /health`, `POST /retell-webhook`, `POST /twilio-webhook`, `POST /search-properties`, `POST /create-lead`, `POST /book-visit`, `POST /update-lead-status`, `POST /post-call-summary`, `POST /trigger-outbound`. **None are authenticated and the Retell webhook signature is not verified** — anyone with the URL can create leads, book visits, or trigger an outbound dialing cycle.

**External services / keys (`.env.example`):**

| Service | Role | Key / cost |
|---|---|---|
| Retell AI | voice agent orchestration; hosts the LLM prompt; records/transcribes | `RETELL_API_KEY`, agent/LLM IDs; free 60 min |
| Twilio | number +1 (662) …, SIP trunk, SMS | `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`; $15 credit |
| Modal | serverless FastAPI + cron | CLI token; $30/mo free compute |
| Notion | CRM, 3 databases | `NOTION_API_KEY`, 3 DB IDs |
| Cal.com | bookings (API v2, `cal-api-version: 2024-08-13`) | `CAL_API_KEY`, event type id |
| Anthropic | post-call analysis | `ANTHROPIC_API_KEY` |

**How Claude is invoked:** twice. (a) Inside Retell as the conversational LLM (`client.llm.create(model="claude-4.5-sonnet", general_prompt=..., general_tools=..., model_temperature=0.4)`). (b) Directly via the Anthropic SDK for post-call analysis (`claude-sonnet-4-5`, `max_tokens=1500`, single user message, JSON-only output with fence-stripping fallback). (c) Claude Code is the intended *installer*: README gives a paste-in prompt asking Claude Code to create accounts, write `.env`, create Notion DBs, create the Retell agent, connect Twilio, deploy Modal.

### 2.3 Mechanics

**Inbound system prompt (`SOFIA_PROMPT`) — structure + strongest fragments (translated where useful):**
```
Eres Sofía, recepcionista virtual de Inmobiliaria Horizontes ...
## Tu personalidad
- Profesional, amable y directa. No das rodeos innecesarios.
- Hablas español mexicano natural — usas "usted" por default pero si el cliente te tutea, tú también lo tuteas.
- Eres eficiente: tu objetivo es entender qué busca el cliente, mostrarle opciones y avanzar hacia una cita.
- Nunca inventas información sobre propiedades. Solo compartes lo que encuentras en el sistema.
```
Qualification questions (stage 1 "Identificar necesidad"):
```
- ¿Compra o renta?                       (buy or rent?)
- ¿Qué tipo? (casa, departamento, penthouse, oficina)
- ¿Qué zona de CDMX le interesa?          (which area?)
- ¿Cuántas recámaras necesita?            (how many bedrooms?)
- ¿Tiene un presupuesto en mente?         (budget in mind?)
No hagas todas las preguntas de golpe. Ve una o dos a la vez, de forma conversacional.
```
Search trigger + presentation rules:
```
Cuando tengas al menos 2 criterios (zona, presupuesto, tipo, recámaras u operación), usa search_properties.
- Menciona máximo 3 propiedades, las más relevantes.
- Di el nombre de la propiedad, la zona, el precio, las recámaras y metros cuadrados.
- Pregunta si alguna le interesa.
```
Lead capture + scoring:
```
- Pide su nombre completo. Confirma su número de teléfono (ya lo tienes del caller ID pero confírmalo). Pregunta si tiene correo.
- Usa create_lead ... Dile: "Perfecto, ya quedó registrado en nuestro sistema."
### 5. Actualizar estatus
- muy interesado (quiere agendar ya, tiene presupuesto claro): temperatura "Hot".
- interés pero no está listo para agendar: "Warm".
- solo está preguntando sin compromiso: "Cold".
## Reglas importantes
- NUNCA inventes propiedades ni precios. Solo di lo que te devuelve el sistema.
- Si no hay resultados ... dile honestamente y sugiere ampliar la búsqueda.
- Si el cliente pregunta algo que no sabes (financiamiento, legales, etc.), dile que un asesor se comunicará con más detalles.
- Sé breve en tus respuestas. Esto es una llamada telefónica, no un correo.
- No repitas información que ya dijiste.
- Si el cliente dice que no le interesa, respeta su decisión y despídete amablemente.
```
Begin message: `"Buenas tardes, gracias por llamar a Inmobiliaria Horizontes. Soy Sofía, ¿en qué puedo ayudarle?"` — note: no disclosure that Sofía is an AI, no recording notice.

**Retell tool definitions** (pattern worth copying for any voice/phone agent): each custom tool has `url`, `method`, JSON-schema `parameters`, `speak_during_execution`, `speak_after_execution`, a `static_text` filler ("Déjame buscar en nuestro sistema las opciones que tenemos disponibles."), and `timeout_ms` 10–15s. `update_lead_status` is silent (`speak_* False`). `end_call` is a built-in tool. Agent settings: `voice_id="cartesia-Sofia"`, `language="es-419"`, `enable_backchannel=True`, `backchannel_words=["ajá","claro","sí","entiendo","mmhmm"]`, `responsiveness=0.8`, `interruption_sensitivity=0.7`, `webhook_events=["call_started","call_ended","call_analyzed"]`.

**Outbound prompt (`SOFIA_OUTBOUND_PROMPT`)** — personalized via Retell dynamic variables `{{lead_name}}, {{zona_interes}}, {{tipo_buscado}}, {{presupuesto}}, {{notas}}`; `begin_message=""`, `start_speaker="agent"`, temperature 0.3. Strongest fragments:
```
- Respetuosa del tiempo. SIEMPRE pregunta primero si tiene un minuto.
- Nunca insistente. Si dicen que no pueden hablar, ofrece llamar en otro momento.
### 1. Apertura (SIEMPRE empieza así)
"Hola, ¿hablo con {{lead_name}}? Le habla Sofía de Inmobiliaria Horizontes. Le llamo porque vi que mostró
 interés en propiedades por {{zona_interes}}. ¿Tiene un minutito?"
### 2. Si dice que NO puede hablar → pregunta cuándo; update_lead_status(siguiente_accion=día/hora); end_call
### 3. Si dice que YA NO le interesa → "Entendido, sin problema. Si en el futuro le surge la necesidad, aquí estamos."
      update_lead_status(temperatura "Cold", estatus "Sin interés"); end_call
### 4. Si SÍ → "Si no me equivoco, estaba interesado en {{tipo_buscado}} por {{zona_interes}}, ¿sigue siendo así o cambió algo?"
      → search_properties → max 2-3 → book_visit → Hot/"Cita agendada" or Warm
## Reglas importantes
- NUNCA insistas si dicen que no. Una sola vez es suficiente.
- La llamada debe ser corta — máximo 3-4 minutos.
```

**Post-call analyzer prompt (`anthropic_service.analyze_call`)** — the JSON contract:
```
Eres un analista CRM de una inmobiliaria ... Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks):
{
  "resumen": "Resumen de 2-3 oraciones de la llamada",
  "nombre_cliente": "...o vacío",
  "temperatura": "Hot si quiere agendar/comprar ya, Warm si muestra interés activo, Cold si solo pregunta sin compromiso",
  "sentimiento": "Positivo, Neutral o Negativo",
  "propiedad_interes": "Descripción breve de lo que busca",
  "presupuesto": null o número sin formato,
  "zonas_interes": ["zona1", "zona2"],
  "siguiente_accion": "Qué hacer después con este lead",
  "cita_agendada": true o false
}
```
On JSON parse failure it silently returns `temperatura: "Warm"`, `siguiente_accion: "Revisar transcripción manualmente"`.

**Post-call pipeline (`process_post_call`)**: get call → transcript, `phone = from_number or to_number`, direction, duration → analyze → `create_call_record(titulo=f"{Inbound|Outbound} — {nombre}", resultado="Contestada", ...)` → `find_lead_by_phone(phone)` exact match → update (temperatura, resumen_ia, siguiente_accion, estatus="Cita agendada" if booked) or create (`fuente="Llamada entrante"|"Otro"`).

**Outbound worker (`run_outbound_cycle`)** — good dedupe pattern, bad compliance:
```
1. Consulta leads con estatus "Pendiente de llamar"  (page_size 20)
2. Cambia su estatus a "En proceso" ANTES de llamar para no duplicar; intentos += 1
3. Dispara llamada outbound con datos personalizados (dynamic variables)
4. Espera 30 segundos entre llamadas; revierte estatus a "Pendiente de llamar" si la llamada falló
```
No calling window, no timezone, no attempt cap, no DNC/opt-out list, no consent flag check. Runs every hour, 24/7.

**Notion CRM schema (reconstructed from `notion_service.py` + `dashboard/src/lib/notion.ts`):**

| DB | Fields |
|---|---|
| **Propiedades** | `Propiedad` (title), `Tipo` (select: Casa, Departamento, Penthouse, Oficina, Local Comercial, Terreno), `Operación` (select: Venta/Renta), `Precio` (number), `Zona` (select: Polanco, Condesa, Roma Norte, Santa Fe, Del Valle, Nápoles, Coyoacán, San Ángel, Interlomas, Lomas de Chapultepec), `Recámaras` (number), `Baños` (number), `m²` (number), `Amenidades` (multi-select), `Dirección` (rich text), `Disponible` (checkbox — always filtered true) |
| **Leads** | `Nombre` (title), `Teléfono` (phone), `Email`, `Estatus` (select: Pendiente de llamar / En proceso / Cita agendada / No contestado / Sin interés / Cerrado), `Temperatura` (Hot/Warm/Cold), `Fuente` (Llamada entrante / Otro), `Intentos de contacto` (number), `Presupuesto` (number), `Zona de interés` (multi), `Tipo buscado` (multi), `Operación buscada` (select), `Notas`, `Resumen IA`, `Siguiente acción` (rich text), `Fecha registro` (date) |
| **Llamadas** | `Llamada` (title), `Tipo` (Inbound/Outbound), `Resultado` (Contestada…), `Teléfono`, `Nombre Lead`, `Duración (seg)`, `Resumen`, `Sentimiento`, `Cita Agendada` (checkbox), `Retell Call ID`, `Fecha` |

**Dashboard** KPIs: Total Leads, Llamadas, Citas Agendadas, "Tasa de Éxito" (= answered ÷ total calls, mislabeled), Duración Promedio, Hot/Warm/Cold counts, status counts, recent calls feed; `/configuracion` edits `begin_message`, `general_prompt`, `model_temperature` live via Retell `PATCH /update-retell-llm/{id}` and has a "trigger outbound" button.

**BRIEF_MEGA_SISTEMA.md** (plan, not code): `sofia.config.yaml` (business, agent voice/personality, CRM product fields, lead extra fields, branding, credentials), a `/setup` Claude Code skill performing 10 steps end-to-end, `prompts/{inmobiliaria,dental,gimnasio,restaurante,clinica,abogados,salon-belleza,veterinaria}.yaml`, dashboard parametrized by config. Confirms the system is a generic receptionist with a real-estate skin.

### 2.4 Compliance posture (as shipped — do not deploy in the US without fixing)
- **TCPA / AI voice:** outbound calls are fully automated with a synthetic voice to a list, on an hourly cron, with no consent flag. In the US the FCC's Feb 2024 declaratory ruling treats AI-generated voices as "artificial or prerecorded" under the TCPA → prior express **written** consent for marketing calls to cell phones, plus calling-hour limits (8am–9pm local under TCPA/TSR), DNC scrubbing, opt-out honoring. None present. The repo's own number is a US +1 (662) number.
- **Recording / two-party consent:** Retell records and transcribes every call; the greeting never discloses recording. California (Penal Code §632 / CIPA) is all-party consent — a mandatory disclosure line is non-negotiable in LA.
- **Bot disclosure:** Sofía never says she is an AI. California's bot-disclosure law (B&P §17940 et seq.) and general UDAP principles make "Soy Sofía, la asistente virtual de…" the safe default.
- **Fair Housing:** the search filters are objective (price, type, bedrooms, area) and the prompt never steers, but there is **no instruction** preventing the LLM from answering "is this a good neighborhood for families / what kind of people live there." No protected-class guardrail, no "I can't characterize neighborhoods; here are objective facts" fallback.
- **Mortgage talk:** "Si el cliente pregunta algo que no sabes (financiamiento, legales…), dile que un asesor se comunicará" — accidentally good posture for a Redfin|Rocket context (RESPA/MLO licensing: non-licensed staff must not quote rates/terms).
- **Data handling:** PII + full transcripts/summaries persisted to Notion with no retention policy; unauthenticated endpoints expose create/update; secrets in Modal secret / gitignored `.env` (fine); test script writes real rows to the production CRM.

### 2.5 Best ideas to steal (for speed-to-lead and inbound qualification at Redfin)
1. **The 5-question qualification spine, "one or two at a time", search after ≥2 criteria, present max 3.** Translate to Redfin: buy/sell/both · timeline · area(s) · beds/baths/must-haves · budget + **pre-approval status (→ Rocket handoff)** · how they found us.
2. **Hot/Warm/Cold rubric tied to concrete behaviors** ("wants to schedule now + clear budget" = Hot) and a **next-action free-text field** on every touch.
3. **Post-call JSON analyzer** → structured CRM row + Slack nudge. Easy to re-host on Claude with Tactiq/Wispr transcripts or agent voice notes.
4. **Status-before-dial dedupe + attempt counter + revert-on-failure** — the correct shape for any follow-up queue, human or AI.
5. **Outbound courtesy script**: name check → who/why → "do you have a minute?" → three branches (no time / no interest / yes) → never push twice → 3–4 minutes max. This is a coachable *human* script for agents, no AI dialer needed.
6. **Dynamic-variable personalization** ("I'm calling because you showed interest in {{area}}") — same idea for first-touch emails/texts drafted by Claude from the lead record.
7. **"Never invent inventory; defer financing/legal to a licensed person; be brief, it's a phone call not an email"** — three lines worth putting in every agent-facing script.
8. **Live-editable prompt in a dashboard** — a manager-owned "script of record" that agents read from, versioned in Drive.

### 2.6 Weaknesses / hollow or risky
- Zero auth on Modal endpoints; no Retell webhook signature check; hard-coded `MODAL_BASE` URL in scripts.
- Inbound-created leads default to `Estatus="En proceso"`, so they are **never** picked up by the outbound worker (it only dials "Pendiente de llamar"); the flywheel described in the README does not close without manual status edits.
- `find_lead_by_phone` is exact string match — +52 vs 52 vs local formats create duplicate leads.
- `book_visit` sends a fake `cliente@inmobiliaria.com` email to Cal.com when none is captured; `event_type_id` default 0/"use 1".
- Analyzer fallback silently labels failures `Warm` — pollutes the pipeline.
- Twilio SMS handler is a `TODO`; "receive messages" capability is unimplemented.
- No tests (the "test" script mutates production Notion). No LICENSE. One commit. Spanish/CDMX hard-coded (zones enumerated in tool descriptions). Dashboard KPI naming is wrong ("Tasa de Éxito").
- The deeper risk: the product is sold as "sin intervención humana" — fully autonomous dialing — which is exactly the configuration that is legally hardest in California.

---

## 3. `skills-for-architects` (Arch Studio) — `skill-maker`, `demographics-analysis`, conventions

### 3.1 Identity
- **Name:** Arch Studio, plugin namespace `as`, v1.5.1.2; "a local-first framework for architecture firms to build, govern, and share their own AI-assisted workflows — use with Codex or Claude Code."
- **Author:** Federico Negro / ALPA (Alpaca Design Lab LLC). **License:** MIT.
- **Scale:** 61 skills, 8 agents, 8 rules, 4 hooks, JSON schemas, a source catalog, cluster manifests, evals. Out-of-scope skill names (listed only): agreement, architecture-knowledge, color-palette-generator, csv-to-sif, drawing-quantity-extract, environmental-analysis, epd-compare, epd-parser, epd-research, epd-to-spec, ffe-spec-book, invoice, learn, lighting-report-extract, master-schedule, meeting-minutes, mobility-analysis, norma, norma-support, nyc-acris, nyc-bsa, nyc-dob-permits, nyc-dob-violations, nyc-hpd, nyc-landmarks, nyc-property-report, occupancy-calculator, product-audit, product-cut-sheet, product-data-cleanup, product-data-import, product-enrich, product-image-processor, product-library, product-match, product-pair, product-research, product-spec-bulk-fetch, product-spec-pdf-parser, product-url-clip, project, proposal, receive, resize-images, schedule-quantity-reconcile, sif-to-csv, site-history, site-visit-report, slide-deck-generator, spec-writer, studio, studio-feedback, tasklist, timetracker, tool-catalog, workplace-programmer, workplan, zoning-analysis-nyc, zoning-envelope.

### 3.2 Architecture (as it bears on skill authoring)
- **Four pillars:** Studio (account/config/standards/assurance), Tooling (skills; "the host performs execution"), Knowledge (source catalog, no bundled copies), Memory (project records in the user's workspace).
- **Per-skill bundle:** `SKILL.md` (authoritative, YAML frontmatter `name`, `description`, optional `allowed-tools`) + short human `README.md` + `host-contract.json` (machine-readable declaration: `path, responsibility, inputs, owned_records, non_owned_records, delegation, modes[{mode, when, required, optional}], execution{model: "harness-native", contract, operations[]}`) + optional `scripts/`, `templates/`, `references/`.
- **Three ownership levels for skills:** bundled plugin cache (never written to) → studio skills `studio/.claude/skills/` → project skills `<project>/.claude/skills/`; explicit global `$HOME/.claude/skills`.
- **Rules directory** with an honest enforcement statement: only `professional-disclaimer` is hook-enforced (marker `<!-- architecture-studio:requires-disclaimer -->` checked by `post-write-disclaimer-check.sh` after Write/Edit); everything else is advisory text copied into skills.
- **Claude invocation:** Claude Code slash commands `/as:<skill>` (catalog) or `/<skill>` (private); Codex `$<skill>`. "Harness-native": skills are specifications; no bundled runner. Hosted MCP variant delivers the same text as instructions only.

### 3.3 Mechanics — `skill-maker`
Frontmatter: `name: skill-maker`, description "Create or update an Arch Studio skill … Use when asked to create, package, adapt or revise a reusable skill.", `allowed-tools: Read, Write, Edit, Glob, Grep, Bash`.

**Target rule (verbatim core):**
```
Derive ordinary authoring choices from the request; do not run a routine setup interview. Ask only for
missing scope, target authorization or a concrete governance conflict.
| Verified catalog checkout   | {project-root}/skills/{name}/                 |
| Studio                      | {studio-root}/{host-skill-root}/{name}/       |
| Explicitly project-only     | {project-root}/{host-skill-root}/{name}/      |
| Explicitly global           | {host-global-skill-root}/{name}/              |
... The installed plugin cache is never a private-skill target. Check existing contents; update a named
existing skill only when the request authorizes it. Otherwise choose a distinct name or ask.
```
**Authoring rules (verbatim — the heart of the repo):**
```
Check existing owners before adding a capability. Give the skill one coherent outcome, a trigger description,
necessary domain facts, interfaces, invariants, evidence and a done condition. Let the host choose valid
methods. Include an ordered procedure only when its order is itself required and explain why. Keep firm and
project facts in their owning workspace; link to governing sources rather than copying them.

Create SKILL.md and a short human-facing README.md. ... Use a kebab-case name matching the directory.
Describe both what the skill does and when to use it. Include allowed-tools only when supported and needed
by the selected host. Do not embed ~/ paths.
```
From PATTERNS.md:
```
State the outcome, necessary inputs and outputs, evidence requirements, domain invariants and observable done
condition. Do not add generic reasoning advice or mandatory steps that the host can derive from those
requirements. ... Behavioral value over the host without the skill requires a representative comparison;
structural lint alone does not establish it. Retire instructions that no longer provide useful information
or measured benefit.
```
**Verify & finish:** structural validator (`skill_scaffold.validate`): directory matches `[a-z0-9]+(?:-[a-z0-9]+)*`; `README.md` and UTF-8 `SKILL.md` exist; frontmatter starts at byte 0 with `---`, parses to a mapping with `name == directory` and non-blank `description`; no `~/` anywhere. "A missing YAML parser leaves that check unverified, never passed." Output exactly `{"valid": true, "directory": ..., "name": ...}` only after destination readback. Then: "If behavior is uncertain, compare representative tasks with and without the skill; report observed value, not an assumed lift." Report paths, invocation, checks, incomplete verification; "Do not commit unless requested."

The two validators (`scripts/validate-skill.sh`, `scripts/validate_skill.py`) are ~40 lines each and portable; the Python one needs `pyyaml`.

**Mutation discipline** (from workspace model, referenced everywhere): `Inspect → Prepare → Verify preparation → Apply → Verify result → Complete`; no-clobber; fresh readback before claiming done.

**Completion-report contract** (`docs/completion-reporting.md`): three outcome states — **Full completion**, **Partial or blocked** ("name what succeeded, what remains, the last verified step and the precise next action… 'write outcome is unknown'"), **Instructions delivered**. "Keep the original denominator; do not reduce scope to match successful items." At most one suggested next action.

**Live-policy pattern** (`docs/studio-policy.md`): generated firm skills re-read the firm's central AI-use policy on every run instead of copying its text; unreadable policy → pause policy-dependent actions, continue independent work.

**Minimal skill template** (`assets/skill-maker-template/SKILL.example.md`, the "transmittal" example): frontmatter → one-line role → `## Usage` examples → `## Outcome and evidence` → `## Output format` (markdown block). ~45 lines total. This is the shape to copy.

### 3.4 Mechanics — `demographics-analysis`
Frontmatter: description "Research population, income, age, housing, and employment around a site. Use for census, demographic, or local-market questions tied to a location." `allowed-tools: WebSearch, WebFetch, Write, Edit, Read, Bash`.
Persona: "You are a senior architect's research assistant. Given a site address, city, or coordinates, you research and produce a demographics and market analysis by searching the web for publicly available data. You are thorough, factual, and concise."
Workflow: "Run 2–4 targeted web searches, fetch the most relevant results, and extract the key data points. If a data point cannot be found, say so explicitly — never fabricate data." Data points: population/density, 10-yr growth, median HH income vs metro/national, age, racial/ethnic composition, housing (median price, rents, stock), employment, education.
Output: `./demographics-analysis-[location-slug].md` with a Key Metrics table, sections, `## Sources` (numbered URLs), `## Gaps & Caveats` (what could not be verified, data vintage, boundary mismatches).
Guidelines (verbatim):
```
- Be factual. Every claim should come from a search result. If you cannot find data, say "Not found in public sources" rather than guessing.
- Cite sources. Include URLs in the Sources section for every page you pulled data from.
- Only use governmental, university, or non-profit sources. Do not cite commercial real estate platforms, ad-supported aggregators, or crowd-sourced neighborhood sites.
- Be concise. Use tables for quantitative data, bullet points for lists. No filler.
- Note data vintage. Always state the year/source (e.g., "2020 Census" or "ACS 2019-2023").
- Compare to benchmarks. Always compare income, prices, and growth to metro and national figures.
- Use local units.
- Ask once, then work. After confirming the location, do all the research without interrupting the user. Present the finished brief.
```
Roughly half of the 9.7 KB file is governance boilerplate (host contract, native mutation sequence, geographic applicability, project context) that adds nothing to the research itself.

### 3.5 Other conventions worth noting
- `rules/professional-disclaimer.md` language rules: "Never say 'this complies with [code]' — say 'this appears consistent with [code section]'"; "Never claim completeness — say 'based on available data'". Canonical end block + HTML-comment sentinel, hook-verified.
- `rules/output-formatting.md`: tables for comparative data, units in headers, descriptive filenames (`888-brannan-zoning-envelope.html not output.html`), YAML front matter on reports (title, date, subject, skill name), sources at section end.
- `rules/transparency.md`: "Report source/data dates separately from retrieval dates."
- CONTRIBUTING: "A run that reports `all checks passed` with skip notices above it has not verified everything. Read the notices."; "Keep SKILL.md authoritative for harness behavior and README.md focused on human-facing purpose, inputs, outputs, and examples."; "Avoid copying authoritative instructions into multiple places. Link to the owning document instead."

### 3.6 Compliance posture
- No calls, no consumer PII; local-first ("does not upload or store studio, project or module records on Arch Studio servers"); optional version check sends one bare request/day after opt-in. Credentials never in package; `.mcp.json` reserved empty.
- Professional-liability framing is strong (disclaimer + hook).
- **Fair Housing landmine if transplanted to real estate:** `demographics-analysis` deliberately reports "Racial/ethnic composition" of a neighborhood. For an architect that is site analysis; for a real-estate agent handing it to a buyer it is textbook steering exposure (HUD/NAR guidance: agents should not characterize neighborhoods by protected class; direct buyers to objective public sources instead). Steal the *structure*, strip protected-class fields, and add a hook-enforced Fair Housing marker.

### 3.7 Best ideas to steal (repeatable skill authoring for a 30-agent team)
1. **Skill = one outcome + trigger + inputs + invariants + evidence + done condition; ordered steps only when order matters.** This is the cure for bloated SKILL.md files.
2. **Three-file bundle**: `SKILL.md` (for Claude) + `README.md` (for agents, 10 lines) + a tiny machine-readable contract (what it reads, what it may write, what it sends externally).
3. **Structural validator** (kebab name = dir, frontmatter name/description, no `~/`) — 40 lines, run before anything ships to the team's shared Drive skills folder.
4. **Marker + hook enforcement** for the one rule that matters: for Redfin that is Fair Housing / Equal Housing language on anything client-facing, and "AI-generated imagery" disclosure on video.
5. **Honest completion reports** — full / partial-blocked / instructions-only; never shrink the denominator.
6. **"Ask once, then work"** and **"Gaps & Caveats" + "Sources with vintage"** sections on every research output (market stats, comps, school data).
7. **Live-policy reference**: skills re-read the team's current Brand & Compliance doc in Drive each run rather than embedding it → one edit updates 30 agents.
8. **"With vs. without" check** before claiming a skill helps.
9. **Ownership levels** (shared team skills vs. an agent's personal skills vs. a listing-specific one) mapped onto Drive folders.

### 3.8 Weaknesses
- Governance prose is enormous and jargon-laden ("R5-HN", "Decision 0018", "Sharmila 1.5", "harness-native", "owning semantic specification"); every skill invocation drags in multiple cross-linked docs → context cost and brittleness if links don't resolve.
- "No routine interview" is right for a repo of experts; a sales-team skill often *needs* a 3-question interview with defaults (re-walkthrough-pro's pattern is better here).
- NYC/architecture-specific sources; validators need `pyyaml`, `jq`, `shellcheck`; much of the contract is unverifiable aspiration ("the host owns execution") rather than tested behavior.
- Skill files mix behavior with boilerplate; the useful research skill is ~40% of its own file.

---

## 4. Synthesis

### 4.1 Top reusable patterns, ranked
1. **Cost-gated, curated, per-room image-to-video with a fixed camera-move vocabulary and "prompt the camera, not the scene"** (repo 1). Immediately runnable on the Higgsfield connector; the single highest-leverage marketing pattern.
2. **Scene-level approval loop + predictable asset folder + shot-list audit trail** (repo 1). Makes video production repeatable across 30 agents.
3. **Qualification spine: 5 questions, 1–2 at a time, act after ≥2 criteria, present ≤3 options, Hot/Warm/Cold on observable behavior, always a next action** (repo 2). Works as a human script, an email drafter, or a future voice agent.
4. **Post-call JSON analyzer → CRM row → nudge** (repo 2). Cheapest way to turn agent call notes into pipeline data and coaching signals.
5. **Skill authoring discipline: one outcome, trigger, inputs, invariants, evidence, done condition; steps only when order matters; validator; README for humans** (repo 3).
6. **Marker + hook enforcement for the one non-negotiable rule** (repo 3) → Fair Housing / Equal Housing / AI-disclosure sentinel on client-facing output.
7. **Honest completion report (full / partial / instructions-only) and "Gaps & Caveats + Sources with vintage"** (repo 3).
8. **Normalize-before-concat, duration≈sum, reframe-don't-regenerate** (repo 1) — ffmpeg hygiene that saves credits and embarrassment.
9. **Status-before-dial queue with attempt counter and revert-on-failure** (repo 2) — correct shape for any follow-up queue; add window/consent/attempt-cap before any automation.
10. **Live policy reference instead of embedded policy text** (repo 3) — one Drive doc governs every skill.

### 4.2 New skills / workflows to build (specs)

**1. `listing-cinematic-reel` — Redfin listing → branded walkthrough + 9:16 reel.**
*Trigger:* agent posts a listing address or Drive photo-folder link in a Slack channel, or manager runs `/listing-cinematic-reel <address>`. *Inputs:* Redfin-commissioned listing photos from Drive (never scraped third-party photos), address, list price, beds/baths/sqft, agent name/DRE#, 3 creative choices with defaults (cinematic/basic · 6–10 hero rooms/all · 16:9 + 9:16). *Process:* text/watermark screen → vision curation into fixed tour order → room→camera-move mapping → Higgsfield `generate_video_batch` + `jobs_wait` at 16:9, one slow move per ~5s clip → ffmpeg normalize/concat → Higgsfield `reframe` for 9:16 → add Redfin|Rocket title card and agent end card (branded still, generated once, reused) → ffprobe duration check. *Outputs:* `listings/<slug>/{PROPERTY.md, source-images/, scenes/, final/walkthrough-16x9.mp4, final/reel-9x16.mp4}` in Drive, caption draft with Equal Housing logo/line and "video includes AI-generated camera motion from listing photos" disclosure, Slack post to the agent with "Do you like it? Name a room to redo." *Quality gate:* repo-1 checklist + Fair Housing wording check + photo-rights check (Redfin photographer license only). *Cost gate:* state credits before generating.

**2. `speed-to-lead-first-touch` — new lead → qualified first response in under 5 minutes (human sends).**
*Trigger:* Gmail label/filter on Redfin or Rocket lead notifications, or a Slack `/lead` paste. *Inputs:* lead email body (name, source, property of interest, message), agent roster + coverage areas (Drive sheet), the team's script of record (Drive doc, re-read each run). *Process:* parse lead → classify (buyer tour request / seller / Rocket referral / sign call) → draft personalized text + email using dynamic-variable style ("I saw you were looking at {{address}} in {{neighborhood}}…") → generate a one-screen call card: 5-question spine (buy/sell · timeline · areas · must-haves · budget + pre-approval status), objection branches (no time / already working with someone / just browsing), Hot/Warm/Cold definitions, next-action field → route to the assigned agent in Slack with the draft (agent sends; nothing auto-sent). *Outputs:* Slack card to agent, Gmail draft in the agent's name, a row appended to the team lead log (Drive sheet) with timestamp-received and timestamp-first-touch for speed coaching. *Hard rules:* human sends; outreach only within 8am–9pm Pacific; honor opt-outs; no financing terms quoted; Fair Housing: never characterize neighborhoods by who lives there.

**3. `call-debrief-to-pipeline` — turn a call into a CRM row and a coaching nudge.**
*Trigger:* agent pastes notes / forwards a Tactiq or Wispr transcript / dictates a 60-second voice memo; or manager runs it on the day's transcripts. *Inputs:* transcript or notes, lead id, the team's qualification rubric. *Process:* Claude extracts the repo-2 JSON (summary, buyer/seller intent, timeline, areas, budget, pre-approval status, temperature with the stated reason, sentiment, appointment booked?, next action + due date, Rocket handoff needed?) → Fair Housing scan of the agent's own language → append to pipeline sheet (status-before-write dedupe on lead id, attempt counter) → Slack DM to agent with next action and one coaching line; weekly rollup to manager (Hot leads with no next action, >3 attempts with no contact, average time-to-first-touch). *Outputs:* sheet row, Slack DM, weekly Gamma/Slack digest. *Never:* silently default to "Warm" on parse failure — mark "needs review."

**4. `buyer-consult-and-rocket-handoff` — consult prep, agreement, and lender introduction.**
*Trigger:* lead reaches "Hot" or a tour is booked. *Inputs:* lead record, consult date, areas, budget, pre-approval status, Docusign templates (buyer representation agreement, disclosures required in California before/at the start of representation — confirm current forms with Redfin compliance), Rocket LO contact. *Process:* produce a consult agenda and a Gamma one-pager (process, timeline, what Redfin|Rocket does, no rate quotes) → if not pre-approved, draft a warm-handoff message to the Rocket loan officer **only after the client says yes to being contacted** (consent captured in the sheet) → queue the Docusign envelope from template with pre-filled names (agent reviews and sends) → log everything. *Outputs:* agenda, Gamma link, Docusign envelope draft, handoff draft, pipeline update. *Hard rules:* agents never quote rates/terms; disclose affiliated-business relationship per Redfin's RESPA language; consent before sharing contact info with the lender.

**5. `redfin-skill-maker` — team skill authoring with validation and compliance sentinel.**
*Trigger:* manager or agent says "make this a skill" / "package our open-house follow-up as a slash command." *Inputs:* the request, the shared skills folder in Drive (`Team Skills/<name>/`), the team's Brand & Compliance doc (live reference), existing skill list (check for an owner first). *Process:* no routine interview — ask only for missing outcome, trigger, or a compliance conflict; author `SKILL.md` + 10-line `README.md` + `contract.json` (reads/writes/sends) using the template in 4.3; run the structural validator; if client-facing output is involved, insert the `<!-- redfin:requires-fair-housing -->` sentinel and the canonical Equal Housing line; run one representative task with and without the skill and report observed difference. *Outputs:* the bundle in Drive, a Slack announcement with 3 usage examples, an entry in the team catalog sheet (name, owner, last validated, with/without result). *Rule:* a skill is never "done" because it was written; it is done when validated and observed to help.

**6. `agent-video-qa-reviewer` — pre-publish review of agent-submitted listing videos.**
*Trigger:* agent drops a video (any source: Higgsfield, phone, vendor) into a Drive folder or Slack. *Inputs:* video, listing facts, brand guide. *Process:* Higgsfield `video_analysis_create` + ffprobe for duration/aspect/fps → checklist: tour order, one move per clip, obvious warping, no third-party watermarks, Redfin|Rocket branding present, Equal Housing line in caption/end card, no "3D/Matterport" claims when it's a cinematic walkthrough, AI-motion disclosure, no prohibited descriptors in caption (Fair Housing word list) → score with the 100/80/50 rubric. *Outputs:* a Slack reply with pass/fix/rework, the specific clips to redo, and a corrected caption. Keeps the manager out of the review loop except for "rework."

### 4.3 Recommended skill-authoring template (distilled from skill-maker, trimmed of governance bloat, with repo-1's interview and repo-3's evidence/report discipline)

```markdown
---
name: <kebab-case, equals folder name>
description: "<What it does>. Use when <trigger phrases agents actually say>. Not for <adjacent cases>."
allowed-tools: [Read, Write, Bash, ...]        # only if needed
version: 0.1.0
owner: <manager or agent name>
---

# /<name> — <one-line outcome>

## Outcome
One sentence: the artifact or decision this produces, and who receives it.

## Trigger / Not for
- Use when: ...
- Not for: ... (prevents mis-triggering; say which skill to use instead)

## Inputs
| Input | Required | Where it comes from | Default |
|---|---|---|---|
Ask at most 3 questions, each with a default; accept "go" to take all defaults. State cost/credits before any paid generation.

## Hard rules (compliance + brand)
- Re-read the team Brand & Compliance doc (Drive link) at the start of every run; if unreadable, stop before any client-facing output.
- Fair Housing: never describe neighborhoods or buyers by protected class; objective facts + public-source links only.
- Humans send client messages; drafts only. Outreach window 8am–9pm Pacific. Honor opt-outs.
- No financing terms quoted by non-licensed people; route to Rocket LO with consent.
- Client-facing output ends with the canonical Equal Housing line and the sentinel `<!-- redfin:requires-fair-housing -->`.

## Procedure (only where order matters — say why)
1. ... (e.g., "normalize before concat because ffmpeg concat fails on mismatched fps")

## Output contract
Exact paths/filenames (`<slug>/final/...`), formats, and where it is posted (Slack channel, Drive folder, Gmail draft).

## Quality checklist + score
- [ ] ...
100% ship · 80–99% fix and ship · 50–79% rework · <50% restart

## Completion report
State one of: Full · Partial/blocked (what succeeded, what remains, last verified step, next action) · Instructions only.
List sources with data vintage, credits spent, files written (after readback), and a Gaps & Caveats section.
Then ask: "Do you like it? Name the part to redo."
```
Companion files: `README.md` (purpose, 3 usage examples, inputs, outputs — 10 lines), `contract.json` (`reads`, `writes`, `sends_externally`, `costs`), optional `checklists/`, `templates/`, `scripts/validate.sh` (kebab name = dir; frontmatter name/description present; no `~/`; sentinel present when `client_facing: true`).

Validation steps before a skill goes into the shared Drive folder: (1) structural validator passes; (2) run one real task with and without the skill, record the observed difference in the catalog sheet; (3) manager spot-checks one client-facing output for Fair Housing language.

---

### Source paths (absolute)
- `<clone>/re-walkthrough-pro/skill/SKILL.md`, `.../skill/tasks/build-walkthrough.md`, `.../skill/frameworks/{higgsfield-camera-moves,stitch-pipeline,apify-zillow-actors}.md`, `.../skill/checklists/walkthrough-quality.md`, `.../skill/templates/property-md.md`, `.../bin/re-walkthrough-pro.js`
- `<clone>/sofia-voice-agent/scripts/create_retell_agent.py` (inbound prompt + tools), `.../scripts/create_outbound_agent.py`, `.../app/main.py`, `.../app/outbound_worker.py`, `.../app/services/{anthropic_service,notion_service,retell_service,calcom_service}.py`, `.../app/webhooks/retell_handler.py`, `.../BRIEF_MEGA_SISTEMA.md`, `.../dashboard/src/lib/notion.ts`
- `<clone>/skills-for-architects/skills/skill-maker/{SKILL.md,README.md,host-contract.json,scripts/validate-skill.sh,scripts/validate_skill.py}`, `.../skills/demographics-analysis/SKILL.md`, `.../PATTERNS.md`, `.../CONTRIBUTING.md`, `.../rules/{README,professional-disclaimer,output-formatting,transparency}.md`, `.../docs/{host-harness-contract,completion-reporting,studio-policy}.md`, `.../assets/skill-maker-template/SKILL.example.md`
