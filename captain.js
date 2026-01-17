const CAPTAIN_GATE_PASSWORD = "fastcarcaptain20032026";/***********************
  Fast Car MR - CAPTAIN
  LocalStorage Version (FAST FIX)
***********************/

const CAPTAIN_GATE_PASSWORD = "fastcarcaptain20032026"; // كلمة سر واجهة الكباتن
const SESSION_KEY = "fastcar_captain_session_local_v1";

const TRIPS_KEY = "fastcar_trips_v1";
const CAPTAINS_KEY = "fastcar_captains_v1";

function $(id){ return document.getElementById(id); }
function toast(msg){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.style.display="block";
  clearTimeout(window.__t);
  window.__t=setTimeout(()=>t.style.display="none",2500);
}

function showMsg(msg){
  const m = $("msg");
  m.style.display="block";
  m.textContent = msg;
}
function hideMsg(){
  const m = $("msg");
  m.style.display="none";
}

function loadTrips(){
  try{ return JSON.parse(localStorage.getItem(TRIPS_KEY) || "[]"); }catch{ return []; }
}
function saveTrips(arr){
  localStorage.setItem(TRIPS_KEY, JSON.stringify(arr));
}
function loadCaptains(){
  try{ return JSON.parse(localStorage.getItem(CAPTAINS_KEY) || "[]"); }catch{ return []; }
}
function saveCaptains(arr){
  localStorage.setItem(CAPTAINS_KEY, JSON.stringify(arr));
}

function saveSession(id){ localStorage.setItem(SESSION_KEY, id); }
function loadSession(){ return localStorage.getItem(SESSION_KEY); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

let captain = null;

function setAuthed(on){
  $("lockBox").style.display = on ? "none" : "block";
  $("app").style.display = on ? "block" : "none";
}

function makeCaptainCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "FC-";
  for(let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function fillUI(){
  $("capName").textContent = captain.full_name || "";
  $("capPhone").textContent = captain.phone || "";
  $("capCode").textContent = captain.code || "";
  $("capPoints").textContent = String(captain.points || 0);
}

function findCaptainById(id){
  const caps = loadCaptains();
  return caps.find(x=>String(x.id)===String(id)) || null;
}

function updateCaptainRecord(){
  const caps = loadCaptains();
  const idx = caps.findIndex(x=>String(x.id)===String(captain.id));
  if(idx>=0){
    caps[idx] = captain;
    saveCaptains(caps);
  }
}

function tripStatusBadge(status){
  const map = {
    available:"متوفر",
    accepted:"مقبول",
    started:"بدأ",
    finished:"انتهى",
    rejected:"مرفوض"
  };
  return map[status] || status;
}

function renderTrips(){
  const all = loadTrips().sort((a,b)=>b.created_at - a.created_at);

  // الكابتن يشوف فقط:
  // - available (المتاحة)
  // - أو المشاوير اللي هو قبلها (accepted/started/finished/rejected مع كوده)
  const visible = all.filter(t=>{
    const mine = t.captain_code && captain && String(t.captain_code)===String(captain.code);
    const targetedOk = !t.target_captain_code || String(t.target_captain_code).toUpperCase()===String(captain.code).toUpperCase();
    if(t.status==="available") return targetedOk;
    return mine;
  });

  const list = $("capTrips");
  list.innerHTML = "";
  $("emptyCap").style.display = visible.length ? "none" : "block";

  for(const t of visible){
    const div = document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <div class="itemTop">
        <div><b>${t.customer_name||"—"}</b> <span class="muted">(${t.customer_phone||"-"})</span></div>
        <div class="badge ${t.status}">${tripStatusBadge(t.status)}</div>
      </div>

      <div class="itemGrid" style="margin-top:10px">
        <div>
          <div class="muted">من</div>
          <b>${t.from_text||"-"}</b>
          <div class="muted">${t.from_lat ? (t.from_lat.toFixed(6)+", "+t.from_lng.toFixed(6)) : "-"}</div>
        </div>
        <div>
          <div class="muted">إلى</div>
          <b>${t.to_text||"-"}</b>
          <div class="muted">${t.to_lat ? (t.to_lat.toFixed(6)+", "+t.to_lng.toFixed(6)) : "-"}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="itemGrid">
        <div><div class="muted">المسافة</div><b>${t.distance_km ? t.distance_km.toFixed(2)+" كم" : "-"}</b></div>
        <div><div class="muted">السعر</div><b>${t.price_old ?? "-"} أوقية قديمة</b></div>
      </div>

      <div class="muted" style="margin-top:8px">
        ملاحظة: ${t.note ? t.note : "—"}
      </div>

      <div class="btnRow">
        ${renderButtonsForTrip(t)}
      </div>
    `;
    list.appendChild(div);

    div.querySelectorAll("button[data-act]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const act = btn.getAttribute("data-act");
        handleTripAction(t.id, act);
      });
    });
  }
}

function renderButtonsForTrip(t){
  // available => accept / reject
  if(t.status==="available"){
    return `
      <button class="btn primary small" data-act="accept">قبول</button>
      <button class="btn danger small" data-act="reject">رفض</button>
      <button class="btn ghost small" data-act="wa">واتساب الزبون</button>
    `;
  }

  // mine accepted => start / reject
  if(t.status==="accepted" && t.captain_code===captain.code){
    return `
      <button class="btn primary small" data-act="start">بدء</button
      document.addEventListener("DOMContentLoaded", () => {
  const lock = document.getElementById("lockBox");
  const app = document.getElementById("app");
  const gateBtn = document.getElementById("gateBtn");

  if (lock && app) {
    lock.style.display = "block";
    app.style.display = "none";
  }

  if (gateBtn) {
    gateBtn.onclick = () => {
      const p = (document.getElementById("gatePass").value || "").trim();
      const msg = document.getElementById("msg");

      if (p !== CAPTAIN_GATE_PASSWORD) {
        if (msg) { msg.style.display="block"; msg.textContent="❌ كلمة السر غير صحيحة"; }
        return;
      }

      if (msg) msg.style.display="none";
      lock.style.display = "none";
      app.style.display = "block";
    };
  }
});
