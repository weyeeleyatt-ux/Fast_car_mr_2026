const VERSION = "CAPTAIN v2026-1";
const CAPTAIN_PASSWORD = "fastcarcaptain20032026";

// ✅ نفس المفتاح تبع الإدارة
const STORE_KEY = "fastcar_shared_trips_v1";
const AUTH_KEY_CAP = "fastcar_auth_cap_v1";

const STATUS = {
  AVAILABLE: "متوفر",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
  STARTED: "بدأ",
  FINISHED: "انتهى",
};

let capFilter = "available";

function $(id){ return document.getElementById(id); }

function toast(msg){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastTO);
  window.__toastTO = setTimeout(()=> t.style.display = "none", 2300);
}

function loadTrips(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}
function saveTrips(trips){
  localStorage.setItem(STORE_KEY, JSON.stringify(trips));
}

function isAuthed(){ return sessionStorage.getItem(AUTH_KEY_CAP) === "1"; }
function setAuthed(ok){ sessionStorage.setItem(AUTH_KEY_CAP, ok ? "1" : "0"); }

function setupAuth(){
  $("capVerBox") && ($("capVerBox").textContent = VERSION);

  $("logoutCapBtn")?.addEventListener("click", ()=>{
    setAuthed(false);
    location.reload();
  });

  if(isAuthed()){
    $("capLockBox").style.display = "none";
    $("capApp").style.display = "block";
    return;
  }

  $("capLoginBtn")?.addEventListener("click", ()=>{
    const p = ($("capPassInput")?.value || "").trim();
    if(p.toLowerCase() === CAPTAIN_PASSWORD.toLowerCase()){
      setAuthed(true);
      toast("✅ تم الدخول");
      location.reload();
    } else {
      $("capLockMsg").style.display = "block";
      $("capLockMsg").textContent = "❌ كلمة السر غير صحيحة";
    }
  });
}

function round1(n){ return Math.round(n*10)/10; }

function matchesFilter(t){
  if(capFilter === "all") return true;
  const mapF = {
    available: STATUS.AVAILABLE,
    accepted: STATUS.ACCEPTED,
    started: STATUS.STARTED,
    finished: STATUS.FINISHED,
    rejected: STATUS.REJECTED
  };
  return t.status === mapF[capFilter];
}

function renderCaptain(){
  const list = $("capTrips");
  const empty = $("capEmpty");

  let trips = loadTrips().sort((a,b)=>Number(b.id)-Number(a.id)).filter(matchesFilter);

  list.innerHTML = "";
  if(trips.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  trips.forEach(t=>{
    const dist = (t.distanceKm != null) ? `${round1(t.distanceKm)} كم` : "—";
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <b>${t.customerName}</b> • ${t.customerPhone}
          <div class="meta">الانطلاق: ${t.pickupText}<br>الوجهة: ${t.dropoffText}</div>
          <div class="meta">المسافة: <b>${dist}</b> • السعر: <b>${t.priceOld}</b> أوقية قديمة</div>
          ${t.note ? `<div class="meta">ملاحظة: ${t.note}</div>` : ``}
          ${t.captainName ? `<div class="meta">الكابتن: <b>${t.captainName}</b></div>` : ``}
        </div>
        <span class="badge">${t.status}</span>
      </div>

      <div class="actions">
        <button class="ok" data-a="accept" data-id="${t.id}">أقبل</button>
        <button class="bad" data-a="reject" data-id="${t.id}">أرفض</button>
        <button data-a="start" data-id="${t.id}">بدأ</button>
        <button data-a="finish" data-id="${t.id}">انتهى</button>
        <button data-a="call" data-phone="${t.customerPhone}">اتصال</button>
      </div>
    `;

    div.addEventListener("click",(e)=>{
      const b = e.target.closest("button");
      if(!b) return;

      if(b.dataset.a === "call"){
        const phone = b.dataset.phone || "";
        if(phone) location.href = `tel:${phone}`;
        return;
      }

      handleAction(b.dataset.id, b.dataset.a);
    });

    list.appendChild(div);
  });
}

function handleAction(id, action){
  const capName = ($("capName")?.value || "").trim();
  const capPhone = ($("capPhone")?.value || "").trim();
  if(!capName){
    toast("⚠️ اكتب اسمك أولاً");
    return;
  }

  const trips = loadTrips();
  const i = trips.findIndex(t=>t.id===id);
  if(i === -1){
    toast("⚠️ المشوار غير موجود");
    return;
  }

  if(action === "accept"){
    trips[i].status = STATUS.ACCEPTED;
    trips[i].captainName = capPhone ? `${capName} (${capPhone})` : capName;
  }

  if(action === "reject"){
    trips[i].status = STATUS.REJECTED;
    trips[i].captainName = capPhone ? `${capName} (${capPhone})` : capName;
  }

  if(action === "start"){
    if(trips[i].status !== STATUS.ACCEPTED && trips[i].status !== STATUS.STARTED){
      toast("⚠️ لازم يكون مقبول أولاً");
      return;
    }
    trips[i].status = STATUS.STARTED;
  }

  if(action === "finish"){
    if(trips[i].status !== STATUS.STARTED){
      toast("⚠️ لازم يكون بدأ أولاً");
      return;
    }
    trips[i].status = STATUS.FINISHED;
  }

  saveTrips(trips);
  toast("✅ تم تحديث الحالة");
  renderCaptain();
}

function setupUI(){
  $("capRefreshBtn")?.addEventListener("click", renderCaptain);

  document.querySelectorAll(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      capFilter = ch.dataset.filter || "available";
      renderCaptain();
    });
  });

  // تحديث تلقائي كل 2 ثواني
  setInterval(()=>{
    if(isAuthed()) renderCaptain();
  }, 2000);
}

window.addEventListener("DOMContentLoaded", ()=>{
  setupAuth();
  if(isAuthed()){
    setupUI();
    renderCaptain();
  }
});
