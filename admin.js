const VERSION = "ADMIN v2026-2";
const ADMIN_PASSWORD = "Fastcaradmin2026";

const STORE_KEY = "fastcar_trips_v2";
const AUTH_KEY_ADMIN = "fastcar_auth_admin_v2";

const STATUS = {
  AVAILABLE: "متوفر",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
  STARTED: "بدأ",
  FINISHED: "انتهى",
};

let adminFilter = "all";
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

function isAuthed(){ return sessionStorage.getItem(AUTH_KEY_ADMIN) === "1"; }
function setAuthed(ok){ sessionStorage.setItem(AUTH_KEY_ADMIN, ok ? "1" : "0"); }

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

  if(!loginBtn || !passInput) return;

  loginBtn.addEventListener("click", ()=>{
    const p = (passInput.value || "").trim();
    if (p.toLowerCase() === ADMIN_PASSWORD.toLowerCase()){
      setAuthed(true);
      toast("✅ تم الدخول");
      location.reload();
    } else {
      if(lockMsg){
        lockMsg.style.display = "block";
        lockMsg.textContent = "❌ كلمة السر غير صحيحة";
      }
    }
  });
}

function renderAdmin(){
  $("adminApp").style.display = "block";
  $("adminListBox").style.display = "block";

  const list = $("adminTrips");
  const empty = $("emptyAdmin");

  let trips = loadTrips().sort((a,b)=>Number(b.id)-Number(a.id));

  if(adminFilter !== "all"){
    const map = {
      available: STATUS.AVAILABLE,
      accepted: STATUS.ACCEPTED,
      started: STATUS.STARTED,
      finished: STATUS.FINISHED,
      rejected: STATUS.REJECTED
    };
    trips = trips.filter(t=>t.status === map[adminFilter]);
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
          ${t.captainName ? `<div class="meta">الكابتن: <b>${t.captainName}</b></div>` : ``}
          ${t.note ? `<div class="meta">ملاحظة: ${t.note}</div>` : ``}
        </div>
        <span class="badge">${t.status}</span>
      </div>
      <div class="actions">
        <button class="ok" data-a="accept" data-id="${t.id}">مقبول</button>
        <button data-a="start" data-id="${t.id}">بدأ</button>
        <button data-a="finish" data-id="${t.id}">انتهى</button>
        <button class="bad" data-a="reject" data-id="${t.id}">مرفوض</button>
        <button class="bad" data-a="del" data-id="${t.id}">حذف</button>
      </div>
    `;
    div.addEventListener("click",(e)=>{
      const b = e.target.closest("button");
      if(!b) return;
      handleAdminAction(b.dataset.id, b.dataset.a);
    });
    list.appendChild(div);
  });
}

function handleAdminAction(id, action){
  const trips = loadTrips();
  const i = trips.findIndex(t=>t.id===id);
  if(i===-1) return;

  if(action==="del"){
    trips.splice(i,1);
    saveTrips(trips);
    toast("🗑️ تم حذف المشوار");
    renderAdmin();
    return;
  }

  if(action==="accept") trips[i].status = STATUS.ACCEPTED;
  if(action==="reject") trips[i].status = STATUS.REJECTED;

  if(action==="start"){
    if(trips[i].status !== STATUS.ACCEPTED && trips[i].status !== STATUS.STARTED){
      toast("⚠️ لازم يكون مقبول أولاً");
      return;
    }
    trips[i].status = STATUS.STARTED;
  }

  if(action==="finish"){
    if(trips[i].status !== STATUS.STARTED){
      toast("⚠️ لازم يكون بدأ أولاً");
      return;
    }
    trips[i].status = STATUS.FINISHED;
  }

  saveTrips(trips);
  toast("✅ تم تحديث الحالة");
  renderAdmin();
}

function createTrip(){
  const name = ($("custName").value || "").trim();
  const phone = ($("custPhone").value || "").trim();
  const pickupText = ($("pickupText").value || "").trim();
  const dropoffText = ($("dropoffText").value || "").trim();
  const priceOld = Number(($("priceOld").value || "900").trim()) || 900;
  const note = ($("note").value || "").trim();

  if(!name || !phone || !pickupText || !dropoffText){
    toast("⚠️ عبّي كل الحقول");
    return;
  }

  const trips = loadTrips();
  trips.push({
    id: Date.now().toString(),
    customerName: name,
    customerPhone: phone,
    pickupText,
    dropoffText,
    priceOld,
    note,
    status: STATUS.AVAILABLE,
    captainName: ""
  });
  saveTrips(trips);

  $("custName").value = "";
  $("custPhone").value = "";
  $("pickupText").value = "";
  $("dropoffText").value = "";
  $("priceOld").value = "900";
  $("note").value = "";

  toast("✅ تم إرسال المشوار");
  renderAdmin();
}

function setupUI(){
  $("createTripBtn").addEventListener("click", createTrip);
  $("clearAllBtn").addEventListener("click", ()=>{
    if(!confirm("حذف كل المشاوير؟")) return;
    saveTrips([]);
    toast("تم حذف الكل");
    renderAdmin();
  });
  $("refreshBtn").addEventListener("click", renderAdmin);

  document.querySelectorAll(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      adminFilter = ch.dataset.filter || "all";
      renderAdmin();
    });
  });
}

window.addEventListener("DOMContentLoaded", ()=>{
  setupAuth();
  if(isAuthed()){
    setupUI();
    renderAdmin();
  }
});
