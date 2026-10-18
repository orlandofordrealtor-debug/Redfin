// "Describe it" assistant. Reads plain-English notes plus any dropped files, picks the best
// template, fills what it can, and explains what it understood and what is still missing.
// Works offline with rules; a Claude prompt is available for richer drafts.
import { STORIES, STORY_ORDER } from '../stories/index.js';
import { LOOKS } from '../looks/index.js';
import { normalizePhoto, parseCSV, fileToDataURL } from '../engine/media.js';

const STORY_RULES = [
  ['anniversary', /anniversar|years? (with|at) (redfin|the company|us)|work ?iversary|celebrat\w* \d+ years?/i, 4],
  ['agent-spotlight', /spotlight|top producer|rookie|promot(ed|ion)|award|milestone|agent of the (month|quarter|year)/i, 3],
  ['team-wins', /team wins?|shout.?outs?|wins? (this|of the) (week|month)|weekly wins|kudos/i, 3],
  ['new-review', /review|testimonial|5.?star|five.?star|zillow|google review/i, 3],
  ['just-sold', /just sold|sold|closed|closing|over asking|multiple offers/i, 2],
  ['just-listed', /just listed|new listing|coming soon|listed|price (improvement|reduc|drop)/i, 2],
  ['under-contract', /under contract|in escrow|pending|accepted offer/i, 3],
  ['open-house', /open house|broker preview|showing/i, 3],
  ['market-update', /market (update|report|stats|snapshot)|median (price|sale)|inventory|days on market|sold report/i, 3],
  ['dashboard-recap', /dashboard|tableau|scorecard|kpi|conversion|attach rate|aicr|metrics|pipeline/i, 3],
  ['leaderboard', /leaderboard|ranking|rankings|race|contest|standings/i, 3],
  ['process-explainer', /how (to|it works|we)|training|tutorial|walkthrough|workflow|process|best practice/i, 2],
  ['client-journey', /escrow timeline|timeline|journey|what happens next|first.?time (home)?buyer|step.?by.?step/i, 2],
  ['rocket-explainer', /rocket|mortgage|pre.?approv|loan officer|financing|attach/i, 2],
  ['meeting-opener', /meeting|agenda|huddle|kick.?off|all.?hands|team call/i, 2],
  ['recruiting', /recruit|join (the|our) team|hiring|career|grow your business/i, 3],
  ['event-promo', /event|workshop|seminar|webinar|rsvp|invite/i, 2],
];

// Looks switch only on explicit style words; otherwise the template's default look (Redfin Glass) is used
const LOOK_RULES = [
  ['luxury', /luxury|premier|high.?end look|cinematic/i],
  ['clay', /\bclay\b|pastel/i],
  ['globe', /\bglobe\b|hologra|sci.?fi/i],
  ['celebration', /confetti|party look|trophy|celebration look/i],
  ['newsroom', /newsroom|news style|ticker|broadcast/i],
  ['kinetic', /kinetic|bold type|type.?only|text only/i],
  ['architectural', /blueprint|wireframe|architectural/i],
  ['neighborhood', /\bmap\b|neighborhood map|drive times?/i],
  ['brand-night', /dark look|night look|dark mode|dramatic/i],
  ['glass-explainer', /glass explainer|futuristic/i],
  ['glass-studio', /glassmorph|frosted|violet|purple/i],
];

const FORMAT_RULES = [
  ['9x16', /vertical|reel|tiktok|instagram story|stories|shorts|9:16|phone|social media/i],
  ['16x9', /youtube|presentation|meeting|slide|wide|16:9|landscape|zoom|screen/i],
  ['1x1', /square|1:1|feed post|linkedin/i],
  ['4x5', /4:5|portrait post|instagram feed/i],
];

export async function smartDraft(text = '', files = []) {
  const notes = [];
  const missing = [];
  const t = String(text || '');

  // 1. Pick the story
  let best = null, bestScore = 0;
  for (const [id, re, w] of STORY_RULES) {
    const m = t.match(new RegExp(re.source, 'gi'));
    const score = (m ? m.length : 0) * w;
    if (score > bestScore) { best = id; bestScore = score; }
  }
  const fileKinds = classifyFiles(files);
  if (!best) {
    if (fileKinds.csv.length || fileKinds.screens.length) best = 'dashboard-recap';
    else if (fileKinds.images.length > 2) best = 'just-sold';
    else best = 'agent-spotlight';
    notes.push(`I couldn't tell the type of video from the description, so I started with ${STORIES[best].name}. You can switch templates any time.`);
  } else notes.push(`Template: ${STORIES[best].name}.`);
  const story = STORIES[best];
  const keys = new Set(story.fields.map(f => f.key));
  const fields = {};
  const setF = (k, v, label) => { if (keys.has(k) && v !== undefined && v !== null && v !== '') { fields[k] = v; if (label) notes.push(label); } };

  // 2. Extract facts from the text
  const url = t.match(/https?:\/\/[^\s)>\]]+/i)?.[0];
  if (url) setF('qrLink', url, `QR code link: ${url}`);
  const email = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  if (email) setF('email', email, `Email: ${email}`);
  const phone = t.match(/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/)?.[0];
  if (phone) setF('phone', phone, `Phone: ${phone}`);
  const dre = t.match(/DRE\s*(?:#|no\.?|number)?\s*:?\s*(\d{7,8})/i)?.[1];
  if (dre) setF('dre', dre, `DRE #${dre}`);
  const years = t.match(/\b(\d{1,2})\s*(?:-|\s)?\s*years?\b/i)?.[1];
  if (years) setF('years', Number(years), `${years} years`);
  const name = findName(t);
  if (name) setF('agentName', name, `Agent: ${name}`);
  const price = t.match(/\$\s?\d[\d,.]*\s?[KkMm]?\b/)?.[0];
  if (price) { const pr = price.replace(/\s/g, '').replace(/[.,]+$/, ''); setF('price', pr, `Price: ${pr}`); }
  const addr = t.match(/\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*\s(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Pl|Place|Ct|Court|Ter|Terrace|Cir|Circle|Pkwy)\b\.?/)?.[0];
  if (addr) setF('address', addr, `Address: ${addr}`);
  const beds = t.match(/(\d+)\s*(?:bd|beds?|bedrooms?)\b/i)?.[1]; if (beds) setF('beds', beds);
  const baths = t.match(/(\d+(?:\.\d)?)\s*(?:ba|baths?|bathrooms?)\b/i)?.[1]; if (baths) setF('baths', baths);
  const sqft = t.match(/([\d,]{3,6})\s*(?:sq\.?\s*ft|square feet|sf)\b/i)?.[1]; if (sqft) setF('sqft', sqft);
  const period = t.match(/\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Q[1-4]\s+\d{4}|week of [A-Z][a-z]+\.? \d{1,2})\b/)?.[0];
  if (period) setF('period', period, `Period: ${period}`);
  const area = t.match(/\b((?:LA|L\.A\.|[A-Z][a-z]+)(?:\s[A-Z][a-z]+)*\s(?:County|Valley|Beach|Hills|Park|Bay|Westside|Coast))\b/)?.[1] || t.match(/\b(Los Angeles|Orange County|Inland Empire|San Fernando Valley|South Bay|Pasadena|Long Beach|Santa Monica)\b/)?.[1];
  if (area) setF('area', area, `Market: ${area}`);
  const thanks = t.match(/(thank you[^.!?\n]*[.!?]?)/i)?.[1];
  if (thanks) setF('message', capitalize(thanks.trim().replace(/[.!?]?$/, '.')), 'Thank-you message from your notes');
  const status = statusFrom(t);
  if (status && keys.has('status')) setF('status', status);

  // duration and format
  let duration = null;
  const range = t.match(/(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*(?:s|sec|seconds)\b/i);
  const single = t.match(/(\d{1,2})\s*(?:s|sec|second)s?\b/i);
  if (range) duration = Math.round((Number(range[1]) + Number(range[2])) / 2);
  else if (single) duration = Number(single[1]);
  if (duration) notes.push(`Length: about ${duration} seconds`);
  let format = story.defaultFormat || '9x16';
  for (const [f, re] of FORMAT_RULES) if (re.test(t)) { format = f; notes.push(`Format: ${f.replace('x', ':')}`); break; }
  let look = story.defaultLook || 'brand-glass';
  for (const [l, re] of LOOK_RULES) if (re.test(t) && LOOKS[l] && !LOOKS[l].placeholder) { look = l; break; }

  // 3. Files
  if (fileKinds.images.length) {
    let rest = [...fileKinds.images];
    if (keys.has('headshot')) {
      const hs = rest.find(f => /head|portrait|profile|agent|me\b|selfie/i.test(f.name)) || (rest.length === 1 && best === 'anniversary' ? rest[0] : null);
      if (hs) { fields.headshot = { src: await normalizePhoto(hs, 1600), name: hs.name }; rest = rest.filter(f => f !== hs); notes.push(`Headshot: ${hs.name}`); }
    }
    if (keys.has('screenshot') && fileKinds.screens.length) {
      const s = fileKinds.screens[0];
      fields.screenshot = { src: await normalizePhoto(s, 2400), name: s.name };
      rest = rest.filter(f => f !== s);
      notes.push(`Screenshot: ${s.name}`);
    }
    const qr = rest.find(f => /qr/i.test(f.name));
    if (qr) { rest = rest.filter(f => f !== qr); notes.push(`${qr.name} looks like a QR code image. The studio makes its own QR code from your link, so add the link it points to.`); }
    if (keys.has('photos') && rest.length) {
      const max = story.fields.find(f => f.key === 'photos')?.max || 12;
      fields.photos = [];
      for (const f of rest.slice(0, max)) fields.photos.push({ src: await normalizePhoto(f, 1800), name: f.name, caption: '', sub: '' });
      notes.push(`${fields.photos.length} photo${fields.photos.length === 1 ? '' : 's'}`);
      if (rest.length > max) notes.push(`You added ${rest.length} photos; this template uses up to ${max}. The rest were left out.`);
    } else if (rest.length && !keys.has('photos')) notes.push(`${rest.length} image${rest.length === 1 ? '' : 's'} not used: this template has no photo slot. Try a listing or spotlight template.`);
  }
  for (const f of fileKinds.csv) {
    const { headers, rows } = parseCSV(await f.text());
    const nameCol = headers.find(x => /name|agent/i.test(x));
    const valCol = headers.find(x => x !== nameCol && rows.some(r => /\d/.test(r[x] || '')));
    const labelCol = headers.find(x => /month|date|period|label|city|area/i.test(x));
    if (nameCol && valCol && keys.has('board')) { fields.board = rows.slice(0, 8).map(r => ({ name: r[nameCol], value: r[valCol] })); notes.push(`Leaderboard from ${f.name} (${nameCol} / ${valCol})`); }
    else if (labelCol && valCol && keys.has('series')) { fields.series = rows.slice(0, 8).map(r => ({ label: r[labelCol], value: r[valCol] })); notes.push(`Chart from ${f.name} (${labelCol} / ${valCol})`); }
    else notes.push(`Read ${f.name} but couldn't match its columns automatically. Copy the numbers into the fields.`);
  }
  for (const f of fileKinds.text) {
    const more = await f.text();
    if (more.length < 20000) return smartDraft(t + '\n' + more, files.filter(x => x !== f));
  }
  if (fileKinds.pdf.length) notes.push(`PDFs can't be read inside the browser. Type the key numbers in, or use "Draft with Claude" to have Claude read ${fileKinds.pdf.map(f => f.name).join(', ')}.`);
  let music = null;
  if (fileKinds.audio.length) { music = await fileToDataURL(fileKinds.audio[0]); notes.push(`Music: ${fileKinds.audio[0].name}`); }
  if (fileKinds.video.length) notes.push('Video clips can’t be placed in scenes yet. Grab a still frame as a photo, or ask Claude to cut the clip into the final render.');

  for (const f of story.fields) if (f.required && f.default === undefined && (fields[f.key] === undefined || fields[f.key] === '')) missing.push(f.label);

  return { story: best, look, format, duration, fields, music, notes, missing };
}

function classifyFiles(files) {
  const k = { images: [], screens: [], csv: [], text: [], pdf: [], audio: [], video: [] };
  for (const f of files) {
    const n = f.name.toLowerCase();
    if (f.type.startsWith('image/')) { k.images.push(f); if (/screen|shot|dashboard|tableau|report|capture|snip/i.test(n)) k.screens.push(f); }
    else if (n.endsWith('.csv') || f.type === 'text/csv') k.csv.push(f);
    else if (/\.(txt|md)$/.test(n) || f.type === 'text/plain' || f.type === 'text/markdown') k.text.push(f);
    else if (n.endsWith('.pdf')) k.pdf.push(f);
    else if (f.type.startsWith('audio/')) k.audio.push(f);
    else if (f.type.startsWith('video/')) k.video.push(f);
  }
  if (!k.screens.length && k.images.length === 1 && /png/i.test(k.images[0].type)) k.screens.push(k.images[0]);
  return k;
}

const NOT_NAMES = /^(Redfin|Rocket|Powered|Just|Sold|Listed|The|This|That|Thank|Celebrat\w*|Happy|Team|Our|My|Los|San|Santa|New|Open|House|Market|Update|Monthly|Weekly|Video|Make|Create|Agent|Agents|With|And|For|Years?|Anniversary|County|September|October|November|December|January|February|March|April|May|June|July|August)$/;
/** Finds a person's name only next to a person cue ("for", "my agent", "congratulations"...). */
function findName(t) {
  const re = /(?:\bfor|\bagents?|celebrat\w*|congratulat\w*|spotlight on|featuring|\bmeet|\bto|named)\s+(?:(?:one of )?(?:my|our) (?:agents?|teammates?)\s+|agents?\s+)?([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){1,2})/g;
  for (const m of t.matchAll(re)) {
    const parts = m[1].split(/\s+/);
    if (parts.some(w => NOT_NAMES.test(w))) continue;
    if (/\b(St|Street|Ave|Avenue|Blvd|Dr|Drive|Rd|Road|Ln|Lane|Way|Pl|Ct|Lake|Hills|Beach|Park|Valley)\b/.test(m[1])) continue;
    return m[1];
  }
  return '';
}

function statusFrom(t) {
  const map = [['sold-over-asking', /over asking/i], ['multiple-offers', /multiple offers/i], ['just-closed', /just closed|closed/i], ['just-sold', /sold/i], ['coming-soon', /coming soon/i], ['price-improved', /price (improvement|reduc|drop)/i], ['back-on-market', /back on (the )?market/i], ['under-contract', /under contract|in escrow/i], ['pending', /pending/i], ['open-house', /open house/i], ['off-market', /off.?market|pocket/i], ['just-listed', /listed|new listing/i]];
  return map.find(([, re]) => re.test(t))?.[0] || null;
}

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

/** A ready-to-paste prompt so Claude can draft the project (and read PDFs/screenshots). */
export function claudePrompt(description, files, storyId) {
  const ids = STORY_ORDER.filter(id => !STORIES[id].hidden);
  const story = STORIES[storyId] || null;
  const schema = (s) => s.fields.map(f => `    "${f.key}": ${typeHint(f)}   // ${f.label}${f.required ? ' (required)' : ''}`).join('\n');
  return `You are helping me fill in a video project for the Redfin Powered by Rocket Creative Studio.

WHAT I WANT:
${description || '(see attached files)'}

FILES I'M ATTACHING: ${files.length ? files.map(f => f.name).join(', ') : 'none'}

Pick the best template from: ${ids.join(', ')}.
${story ? `I think it's "${story.id}". Its fields are:\n{\n${schema(story)}\n}` : ''}

Rules:
- Use only facts from my description and files. Never invent numbers, names, prices, reviews or program terms. Leave a field out if you don't know it.
- Keep headlines short (under 8 words) and items under 7 words.
- Read numbers from screenshots or PDFs exactly as shown and include the source and as-of date in "source".
- Images I attach can't travel through this JSON: tell me which file goes in which image field instead.

Reply with only this JSON:
{"story": "<template id>", "look": "<optional look id>", "format": "9x16 | 16x9 | 1x1 | 4x5", "fields": { ... }, "notes": "<what I still need to add>"}`;
}

function typeHint(f) {
  switch (f.type) {
    case 'number': return 'number';
    case 'list': return '["item", ...]';
    case 'stats': return '[{"value": "24", "label": "..."}]';
    case 'rows': return '[{"name": "...", "value": "..."}]';
    case 'series': return '[{"label": "...", "value": "..."}]';
    case 'milestones': return '[{"label": "...", "title": "..."}]';
    case 'callouts': return '[{"x": 0.5, "y": 0.3, "label": "..."}]';
    case 'image': case 'images': return '"(upload in the studio)"';
    case 'select': return `"${f.options.map(o => o.value).join(' | ')}"`;
    default: return '"text"';
  }
}

/** Parses Claude's JSON reply (tolerates code fences and surrounding text). */
export function parseClaudeReply(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON found. Paste the whole reply from Claude.');
  const j = JSON.parse(m[0]);
  if (!j.story || !STORIES[j.story]) throw new Error(`Unknown template "${j.story}".`);
  const story = STORIES[j.story];
  const keys = new Set(story.fields.map(f => f.key));
  const fields = {};
  for (const [k, v] of Object.entries(j.fields || {})) {
    const f = story.fields.find(x => x.key === k);
    if (!keys.has(k) || !f || ['image', 'images'].includes(f.type)) continue;
    fields[k] = v;
  }
  return { story: j.story, look: LOOKS[j.look] ? j.look : null, format: ['9x16', '16x9', '1x1', '4x5'].includes(j.format) ? j.format : null, fields, notes: j.notes || '' };
}
