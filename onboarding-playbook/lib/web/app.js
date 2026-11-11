(function(){
  "use strict";
  var D = JSON.parse(document.getElementById("pb-data").textContent);
  var KEY = D.storeKey;
  var S = {checks:{}, audit:{}, notes:{}, fields:{}, flow:{}, trk:{}};
  try { var raw = window.localStorage.getItem(KEY); if (raw) { var p = JSON.parse(raw); for (var k in S) if (p[k]) S[k] = p[k]; } } catch(e) {}
  var saveT;
  function save(){ clearTimeout(saveT); saveT = setTimeout(function(){ try { window.localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} }, 150); }
  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function esc(t){ return String(t).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function field(id){ return (S.fields[id] || "").trim(); }

  /* ---------- toast & copy ---------- */
  var toastEl = $(".toast"), toastT;
  function toast(msg){ toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function(){ toastEl.classList.remove("on"); }, 1800); }
  function copyText(t){
    function fallback(){ var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Copied to clipboard"); } catch(e) { toast("Select and copy manually"); } document.body.removeChild(ta); }
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(t).then(function(){ toast("Copied to clipboard"); }, fallback); } else { fallback(); }
  }

  /* ---------- checkboxes ---------- */
  $$("input[type=checkbox][data-id]").forEach(function(cb){
    var id = cb.getAttribute("data-id");
    cb.checked = !!S.checks[id];
    cb.closest(".check").classList.toggle("done", cb.checked);
    cb.addEventListener("change", function(){ S.checks[id] = cb.checked; if (!cb.checked) delete S.checks[id]; cb.closest(".check").classList.toggle("done", cb.checked); save(); progress(); });
  });

  /* ---------- progress ---------- */
  var CIRC = 2 * Math.PI * 18;
  function progress(){
    var total = 0, done = 0, phase = {};
    D.modules.forEach(function(m){
      var d = 0; m.actions.forEach(function(a){ if (S.checks[a]) d++; });
      total += m.actions.length; done += d;
      phase[m.phase] = phase[m.phase] || [0, 0]; phase[m.phase][0] += d; phase[m.phase][1] += m.actions.length;
      var pct = Math.round(100 * d / m.actions.length);
      $$('[data-mod-bar="' + m.id + '"]').forEach(function(el){ el.style.width = pct + "%"; });
      $$('[data-mod-pct="' + m.id + '"]').forEach(function(el){ el.textContent = pct + "%"; });
      var aside = $('[data-actions="' + m.id + '"]'); if (aside) aside.classList.toggle("complete", d === m.actions.length);
      $$('[data-mod-chip="' + m.id + '"]').forEach(function(el){
        el.className = "chip " + (d === 0 ? "ns" : d === m.actions.length ? "ok" : "ip");
        el.textContent = d === 0 ? "Not started" : d === m.actions.length ? "Complete" : d + " of " + m.actions.length;
      });
    });
    Object.keys(phase).forEach(function(p){
      var pct = Math.round(100 * phase[p][0] / phase[p][1]);
      $$('[data-phase-bar="' + p + '"]').forEach(function(el){ el.style.width = pct + "%"; });
      $$('[data-phase-pct="' + p + '"]').forEach(function(el){ el.textContent = pct + "% complete"; });
    });
    var all = total ? Math.round(100 * done / total) : 0;
    var ring = $("#ring-arc"); if (ring) ring.setAttribute("stroke-dashoffset", (CIRC * (1 - all / 100)).toFixed(2));
    var rv = $("#ring-val"); if (rv) rv.textContent = all + "%";
  }

  /* ---------- audit ---------- */
  var GC = 2 * Math.PI * 74;
  function audit(){
    var y = 0, n = 0, na = 0, fixes = [];
    D.audit.forEach(function(it){
      var v = S.audit[it.id];
      var row = $('[data-aud-item="' + it.id + '"]');
      if (row) {
        $$("button", row).forEach(function(b){ b.setAttribute("aria-pressed", b.getAttribute("data-v") === v ? "true" : "false"); });
        row.classList.toggle("is-no", v === "no");
      }
      if (v === "yes") y++; else if (v === "no") { n++; fixes.push(it); } else if (v === "na") na++;
    });
    var answered = y + n + na;
    var score = (y + n) ? Math.round(100 * y / (y + n)) : 0;
    var arc = $("#gauge-arc"); if (arc) arc.setAttribute("stroke-dashoffset", (GC * (1 - score / 100)).toFixed(2));
    $("#g-score").textContent = (y + n) ? score + "%" : "—";
    $("#c-yes").textContent = y; $("#c-no").textContent = n; $("#c-na").textContent = na;
    var band = D.bands[D.bands.length - 1];
    for (var i = 0; i < D.bands.length; i++) { if (score >= D.bands[i].min) { band = D.bands[i]; break; } }
    $("#g-band").textContent = answered < D.audit.length ? answered + " of " + D.audit.length + " scored" : band.name;
    $("#g-band-t").textContent = answered < D.audit.length ? "Score every item to see your readiness band." : band.text;
    var fl = $("#fixlist");
    if (!fixes.length) { fl.innerHTML = '<p class="empty">' + (n === 0 && answered ? "No gaps flagged. Strong start." : "Your “No” answers will appear here with the module that fixes each one.") + "</p>"; }
    else {
      fl.innerHTML = "<ol>" + fixes.map(function(it){
        var note = (S.notes[it.id] || "").trim();
        return "<li><b>" + esc(it.label) + "</b>" + (note ? " — " + esc(note) : "") + '<br><a href="#' + it.fix + '">Fix in Module ' + esc(it.fixNum) + ": " + esc(it.fixTitle) + " →</a></li>";
      }).join("") + "</ol>";
    }
    commitSuggestions(fixes);
  }
  $$("[data-aud-item]").forEach(function(row){
    var id = row.getAttribute("data-aud-item");
    $$("button", row).forEach(function(b){ b.addEventListener("click", function(){ var v = b.getAttribute("data-v"); S.audit[id] = S.audit[id] === v ? undefined : v; if (!S.audit[id]) delete S.audit[id]; save(); audit(); }); });
  });
  $$("textarea[data-note]").forEach(function(t){ var id = t.getAttribute("data-note"); t.value = S.notes[id] || ""; t.addEventListener("input", function(){ S.notes[id] = t.value; save(); audit(); }); });

  /* ---------- generic fields ---------- */
  var renderers = [];
  $$("[data-field]").forEach(function(el){
    var id = el.getAttribute("data-field");
    if (S.fields[id] === undefined && el.getAttribute("data-default")) S.fields[id] = el.getAttribute("data-default");
    el.value = S.fields[id] || "";
    el.addEventListener("input", function(){ S.fields[id] = el.value; save(); renderers.forEach(function(f){ f(); }); });
  });

  /* ---------- assistant setup flow ---------- */
  function flow(){
    $$("[data-flow]").forEach(function(b){ b.setAttribute("aria-pressed", S.flow[b.getAttribute("data-flow")] === b.getAttribute("data-v") ? "true" : "false"); });
    var q1 = S.flow.q1, q2 = S.flow.q2;
    var n1 = $("#fn-q1"), n2 = $("#fn-q2"), n3 = $("#fn-ready");
    if (!n1) return;
    n1.classList.toggle("show-fix", q1 === "no");
    n2.classList.toggle("dim", q1 !== "yes");
    n2.classList.toggle("show-fix", q1 === "yes" && q2 === "no");
    n3.classList.toggle("dim", !(q1 === "yes" && q2 === "yes"));
  }
  $$("[data-flow]").forEach(function(b){ b.addEventListener("click", function(){ S.flow[b.getAttribute("data-flow")] = b.getAttribute("data-v"); save(); flow(); }); });

  /* ---------- prompts ---------- */
  function priceRender(){
    var v = field("tier_price");
    $$(".px").forEach(function(s){ s.textContent = v ? v : "[$X]"; });
  }
  renderers.push(priceRender);
  $$("[data-copy]").forEach(function(b){ b.addEventListener("click", function(){ var t = $(b.getAttribute("data-copy")); if (t) copyText(t.innerText.trim()); }); });
  $$("[data-expand]").forEach(function(b){ b.addEventListener("click", function(){ var t = $(b.getAttribute("data-expand")); t.classList.toggle("open"); b.textContent = t.classList.contains("open") ? "Collapse" : "Expand"; }); });

  /* ---------- case study preview ---------- */
  function caseRender(){
    var box = $("#cs-preview"); if (!box) return;
    function v(id, ph){ var x = field(id); return x ? esc(x) : '<span class="ghost">' + esc(ph) + "</span>"; }
    $("#pv-headline").innerHTML = v("cs_headline", "[Address]: [The result in a few words]");
    $("#pv-challenge").innerHTML = v("cs_challenge", "What made this home harder to sell than it looked?");
    $("#pv-strategy").innerHTML = "<ol><li>" + v("cs_move1", "Move 1") + "</li><li>" + v("cs_move2", "Move 2") + "</li><li>" + v("cs_move3", "Move 3") + "</li></ol>";
    $("#pv-result").innerHTML = v("cs_result", "Showings, offers, timing, final price.");
    var q = field("cs_quote"); $("#pv-quote").innerHTML = q ? "“" + esc(q.replace(/^[“"]|[”"]$/g, "")) + "”" : '<span class="ghost">“[Seller quote]”</span>';
    var words = ["cs_headline","cs_challenge","cs_move1","cs_move2","cs_move3","cs_result","cs_quote"].map(field).join(" ").split(/\s+/).filter(Boolean).length;
    var wc = $("#cs-wc"); wc.textContent = words + " / ~200 words"; wc.classList.toggle("over", words > 230);
  }
  renderers.push(caseRender);
  var csCopy = $("#cs-copy");
  if (csCopy) csCopy.addEventListener("click", function(){
    copyText([field("cs_headline"), "", "THE CHALLENGE", field("cs_challenge"), "", "THE STRATEGY", "1. " + field("cs_move1"), "2. " + field("cs_move2"), "3. " + field("cs_move3"), "", "THE RESULT", field("cs_result"), "", "IN THE SELLER'S WORDS", "“" + field("cs_quote") + "”"].join("\n"));
  });

  /* ---------- value prop ---------- */
  function vpRender(){
    var out = $("#vp-out"); if (!out) return;
    function v(id, ph){ var x = field(id); return x ? "<b>" + esc(x) + "</b>" : '<span style="opacity:.55">' + ph + "</span>"; }
    out.innerHTML = "I help " + v("vp_who", "[who]") + " in " + v("vp_where", "[where]") + " " + v("vp_what", "[achieve what]") + " through " + v("vp_how", "[how]") + ", proven by " + v("vp_proof", "[your result]") + ".";
  }
  renderers.push(vpRender);
  var vpCopy = $("#vp-copy"); if (vpCopy) vpCopy.addEventListener("click", function(){ copyText($("#vp-out").innerText); });

  /* ---------- talk timer ---------- */
  var tEl = $("#talk-clock"), tInt = null, tSec = 0, BEATS = [0, 20, 50, 80, 105, 120];
  function tPaint(){
    if (!tEl) return;
    var r = Math.max(0, 120 - tSec); tEl.textContent = Math.floor(r / 60) + ":" + ("0" + (r % 60)).slice(-2);
    $$(".beat").forEach(function(b, i){ b.classList.toggle("live", tInt !== null && tSec >= BEATS[i] && tSec < BEATS[i + 1]); });
  }
  var tStart = $("#talk-start"), tReset = $("#talk-reset");
  if (tStart) tStart.addEventListener("click", function(){
    if (tInt) { clearInterval(tInt); tInt = null; tStart.textContent = "Resume"; tPaint(); return; }
    if (tSec >= 120) tSec = 0;
    tStart.textContent = "Pause";
    tInt = setInterval(function(){ tSec++; if (tSec >= 120) { clearInterval(tInt); tInt = null; tStart.textContent = "Start again"; toast("Time! That's your two minutes."); } tPaint(); }, 1000);
    tPaint();
  });
  if (tReset) tReset.addEventListener("click", function(){ clearInterval(tInt); tInt = null; tSec = 0; if (tStart) tStart.textContent = "Start 2:00 practice"; tPaint(); });
  tPaint();

  /* ---------- touch date helper ---------- */
  function touchRender(){
    var out = $("#touch-out"); if (!out) return;
    var v = field("touch1_date");
    if (!v) { out.innerHTML = "Enter the date you mailed Touch 1 to see your Touch 2 window."; return; }
    var d = new Date(v + "T12:00:00"); if (isNaN(d)) return;
    function f(x){ var c = new Date(d); c.setDate(c.getDate() + x); return c.toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"}); }
    out.innerHTML = "Send Touch 2 between <b>" + f(10) + "</b> and <b>" + f(14) + "</b>.";
  }
  renderers.push(touchRender);

  /* ---------- trackers ---------- */
  $$("input[data-trk]").forEach(function(inp){
    var id = inp.getAttribute("data-trk"), r = +inp.getAttribute("data-r"), c = +inp.getAttribute("data-c");
    S.trk[id] = S.trk[id] || {};
    inp.value = (S.trk[id][r + "_" + c]) || "";
    inp.addEventListener("input", function(){ S.trk[id][r + "_" + c] = inp.value; save(); });
  });

  /* ---------- email blocks ---------- */
  $$("[data-mailto]").forEach(function(b){ b.addEventListener("click", function(){
    var subj = b.getAttribute("data-subject") || "", body = $(b.getAttribute("data-mailto")).innerText;
    window.location.href = "mailto:?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
  }); });

  /* ---------- commitments ---------- */
  function commitSuggestions(fixes){
    var box = $("#cm-sugg"); if (!box) return;
    var seen = {}, list = [];
    fixes.forEach(function(it){ if (!seen[it.fix]) { seen[it.fix] = 1; list.push("Complete Module " + it.fixNum + " (" + it.fixTitle + ") to fix my " + it.label + " gap by [date]."); } });
    list = list.concat(D.commitExamples).slice(0, 7);
    box.innerHTML = list.map(function(t){ return '<button type="button">' + esc(t) + "</button>"; }).join("");
    $$("button", box).forEach(function(b){ b.addEventListener("click", function(){
      for (var i = 1; i <= 3; i++) { var el = $('[data-field="cm_' + i + '"]'); if (el && !el.value.trim()) { el.value = b.textContent; S.fields["cm_" + i] = el.value; save(); el.focus(); toast("Added to commitment " + i); return; } }
      toast("All three commitments are filled. Edit one to swap it.");
    }); });
  }
  function commitText(){
    var lines = [D.programName + " · My 3 Commitments", "", "Agent: " + field("cm_agent"), "Manager: " + field("cm_manager"), ""];
    for (var i = 1; i <= 3; i++) lines.push(i + ". " + field("cm_" + i) + (field("cm_" + i + "_by") ? "  (by " + field("cm_" + i + "_by") + ")" : ""));
    var y = 0, n = 0; D.audit.forEach(function(it){ if (S.audit[it.id] === "yes") y++; if (S.audit[it.id] === "no") n++; });
    if (y + n) lines.push("", D.priceTier + " Audit readiness: " + Math.round(100 * y / (y + n)) + "%");
    var t = 0, d = 0; D.modules.forEach(function(m){ m.actions.forEach(function(a){ t++; if (S.checks[a]) d++; }); });
    lines.push("Onboarding progress: " + Math.round(100 * d / t) + "% (" + d + " of " + t + " actions)");
    return lines.join("\n");
  }
  var cc = $("#cm-copy"); if (cc) cc.addEventListener("click", function(){ copyText(commitText()); });
  var ce = $("#cm-email"); if (ce) ce.addEventListener("click", function(){ window.location.href = "mailto:?subject=" + encodeURIComponent("My 3 " + D.tier + " Commitments — " + (field("cm_agent") || "")) + "&body=" + encodeURIComponent(commitText()); });
  var cp = $("#cm-print"); if (cp) cp.addEventListener("click", function(){ window.print(); });

  /* ---------- nav highlight ---------- */
  var links = $$(".topbar nav a");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function(entries){ entries.forEach(function(e){ if (e.isIntersecting) { var id = e.target.getAttribute("data-nav"); links.forEach(function(a){ a.classList.toggle("on", a.getAttribute("href") === "#" + id); }); } }); }, {rootMargin: "-45% 0px -50% 0px"});
    $$("[data-nav]").forEach(function(s){ io.observe(s); });
  }

  /* ---------- reset ---------- */
  var rs = $("#reset"); if (rs) rs.addEventListener("click", function(){
    if (!window.confirm("Clear all of your checkmarks, audit answers, and notes on this device?")) return;
    try { window.localStorage.removeItem(KEY); } catch(e) {}
    window.location.reload();
  });

  progress(); audit(); flow(); renderers.forEach(function(f){ f(); });
})();
