const VERSION = "CAPTAIN v2026-2";
const CAPTAIN_PASSWORD = "fastcarcaptain20032026";

const STORE_KEY = "fastcar_trips_v2";
const AUTH_KEY_CAPTAIN = "fastcar_auth_captain_v2";

const STATUS = {
  AVAILABLE: "متوفر",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
  STARTED: "بدأ",
  FINISHED: "انتهى",
};

const $ = (id) => document.getElementById(id);

function toast(msg){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastTO);
  window.__toastTO = setTimeout(()=> t.style.display = "none", 2200);
}

function loadTrips(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}
function saveTrips(trips){
  localStorage.setItem(STORE_KEY, JSON.stringify(trips));
}

function isAuthed(){ return sessionStorage.getItem(AUTH_KEY_CAPTAIN) === "1"; }
function setAuthed(ok){ sessionStorage.setItem(AUTH_KEY_CAPTAIN, ok ? "1" : "0"); }

function setupAuth(){
  const ver1 = $("verBox"), ver2 = $("verBox2");
  if(ver1) ver1.textContent = VERSION;
  if(ver2) ver2.textContent = VERSION;

  const lockBox = $("lockBox");
  const loginBtn = $("loginBtn");
  const passInput = $("passInput");
  const lockMsg = $("lockMsg");
  const logoutBtn = $("logoutBtn");

  if (logoutBtn){
    logoutBtn.addEventListener("click", ()=>{
      setAuthed(false);
      location.reload();
    });
  }

  if (isAuthed()){
    if(lockBox) lockBox.style.display = "none";
    return;
  }

  loginBtn.addEventListener("click", ()=>{
    const p = (passInput.value || "").trim();
    if (p.toLowerCase() === CAPTAIN_PASSWORD.toLowerCase()){
      setAuthed(true);
      toast("✅ تم الدخول");
      location.reload();
    } else {
      lockMsg.style.display = "block";
      lockMsg.textContent = "❌ كلمة السر غير صحيحة";
    }
  });
}

function renderCaptain(){
  $("captainApp").style.display = "block";
  const list = $("captainTrips");
  const empty = $("emptyCaptain");

  const capName = ($("captainName").value || "").trim();
  const view = $("capView").value;

  let trips = loadTrips().sort((a,b)=>Number(b.id)-Number(a.id));

  if(view === "available"){
    trips = trips.filter(t=>t.status === STATUS.AVAILABLE);
  } else if(view === "mine"){
    trips = trips.filter(t=>capName && t.captainName === capName);
  }

  list.innerHTML = "";
  if(trips.length === 0){ empty.style.display = "block"; return; }
  empty.style.display = "none";

  trips.forEach(t=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <b>${t.customerName}</b> • ${t.customerPhone}
          <div class="meta">الانطلاق: ${t.pickupText}<br>الوجهة: ${t.dropoffText}</div>
          <div class="meta">السعر: <b>${t.priceOld}</b> أوقية قديمة</div>
          ${t.note ? `<div class="meta">ملاحظة: ${t.note}</div>` : ``}
          ${t.captainName ? `<div class="meta">الكابتن: <b>${t.captainName}</b></div>` : ``}
        </div>
        <span class="badge">${t.status}</span>
      </div>
      <div class="actions">
        <button class="ok" data-a="accept" data-id="${t.id}">قبول</button>
        <button class="bad" data-a="reject" data-id="${t.id}">رفض</button>
        <button data-a="start" data-id="${t.id}">بدء</button>
        <button data-a="finish" data-id="${t.id}">إنهاء</button>
      </div>
    `;
    div.addEventListener("click",(e)=>{
      const b = e.target.closest("button");
      if(!b) return;
      handleCaptainAction(b.dataset.id, b.dataset.a);
    });
    list.appendChild(div);
  });
}

function handleCaptainAction(id, action){
  const trips = loadTrips();
  const i = trips.findIndex(t=>t.id===id);
  if(i===-1) return;

  const capName = ($("captainName").value || "").trim();

  if(action==="accept"){
    if(!capName){ toast("⚠️ اكتب اسمك أولاً"); return; }
    if(trips[i].status !== STATUS.AVAILABLE){ toast("⚠️ ليس متوفر"); return; }
    trips[i].status = STATUS.ACCEPTED;
    trips[i].captainName = capName;
  }

  if(action==="reject"){
    if(trips[i].status !== STATUS.AVAILABLE){ toast("⚠️ لا يمكن رفض غير متوفر"); return; }
    trips[i].status = STATUS.REJECTED;
  }

  if(action==="start"){
    if(trips[i].status !== STATUS.ACCEPTED && trips[i].status !== STATUS.STARTED){
      toast("⚠️ لازم يكون مقبول أولاً"); return;
    }
    trips[i].status = STATUS.STARTED;
  }

  if(action==="finish"){
    if(trips[i].status !== STATUS.STARTED){ toast("⚠️ لازم يكون بدأ أولاً"); return; }
    trips[i].status = STATUS.FINISHED;
  }

  saveTrips(trips);
  toast("✅ تم تحديث الحالة");
  renderCaptain();
}

window.addEventListener("DOMContentLoaded", ()=>{
  setupAuth();
  if(isAuthed()){
    renderCaptain();
    $("refreshBtn").addEventListener("click", renderCaptain);
    $("capView").addEventListener("change", renderCaptain);
  }
});
