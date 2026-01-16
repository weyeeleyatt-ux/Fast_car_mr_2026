const VERSION = "ADMIN MAP v2026-map-1";
const ADMIN_PASSWORD = "Fastcaradmin2026";

const STORE_KEY = "fastcar_trips_v4";
const AUTH_KEY_ADMIN = "fastcar_auth_admin_v4";

const STATUS = {
  AVAILABLE: "متوفر",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
  STARTED: "بدأ",
  FINISHED: "انتهى",
};

// تسعير
const MIN_PRICE_OLD = 900;     // حد أدنى
const RATE_OLD_PER_KM = 300;   // سعر لكل كم (عدّله)

let adminFilter = "all";

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

function isAuthed(){ return sessionStorage.getItem(AUTH_KEY_ADMIN) === "1"; }
function setAuthed(ok){ sessionStorage.setItem(AUTH_KEY_ADMIN, ok ? "1" : "0"); }

function setupAuth(){
  const v1 = $("verBox"), v2 = $("verBox2");
  if(v1) v1.textContent = VERSION;
  if(v2) v2.textContent = VERSION;

  const lockBox = $("lockBox");
  const loginBtn = $("loginBtn");
  const passInput = $("passInput");
  const lockMsg = $("lockMsg");
  const logoutBtn = $("logoutBtn");

  logoutBtn?.addEventListener("click", ()=>{
    setAuthed(false);
    location.reload();
  });

  if(isAuthed()){
    if(lockBox) lockBox.style.display = "none";
    return;
  }

  loginBtn?.addEventListener("click", ()=>{
    const p = (passInput?.value || "").trim();
    if(p.toLowerCase() === ADMIN_PASSWORD.toLowerCase()){
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

function round1(n){ return Math.round(n*10)/10; }

function calcPriceOld(distanceKm){
  return Math.max(MIN_PRICE_OLD, Math.round(distanceKm * RATE_OLD_PER_KM));
}

/* ================= MAP ================= */
let map, pickupMarker, dropoffMarker, routeLine;
let pickup = null;   // {lat, lon}
let dropoff = null;  // {lat, lon}

function setText(id, txt){
  const el = $(id);
  if(el) el.textContent = txt;
}

function resetMapUI(){
  pickup = null;
  dropoff = null;
  pickupMarker?.remove(); pickupMarker = null;
  dropoffMarker?.remove(); dropoffMarker = null;
  routeLine?.remove(); routeLine = null;

  setText("pickupLabel","غير محدد");
  setText("dropoffLabel","غير محدد");
  setText("distanceLabel","—");
  setText("autoPriceLabel","—");

  const priceInput = $("priceOld");
  if(priceInput) priceInput.value = String(MIN_PRICE_OLD);

  const p1 = $("pickupText");
  const p2 = $("dropoffText");
  if(p1) p1.value = "";
  if(p2) p2.value = "";
}

async function fetchRoute(p1, p2){
  const url = `https://router.project-osrm.org/route/v1/driving/${p1.lon},${p1.lat};${p2.lon},${p2.lat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  if(!r.ok) throw new Error("route_failed");
  const data = await r.json();
  const route = data?.routes?.[0];
  if(!route) throw new Error("no_route");
  return { km: route.distance/1000, geo: route.geometry };
}

function drawRoute(geo){
  routeLine?.remove();
  routeLine = L.geoJSON(geo, {});
  routeLine.addTo(map);
  try { map.fitBounds(routeLine.getBounds(), { padding:[20,20] }); } catch {}
}

async function updateDistanceAndPrice(){
  if(!pickup || !dropoff){
    setText("distanceLabel","—");
    setText("autoPriceLabel","—");
    return;
  }

  setText("distanceLabel","جاري الحساب…");
  setText("autoPriceLabel","…");

  try{
    const out = await fetchRoute(pickup, dropoff);
    const km = out.km;
    const priceOld = calcPriceOld(km);

    setText("distanceLabel", `${round1(km)} كم`);
    setText("autoPriceLabel", `${priceOld}`);

    const priceInput = $("priceOld");
    if(priceInput) priceInput.value = String(priceOld);

    drawRoute(out.geo);
  }catch{
    setText("distanceLabel","تعذر حساب المسافة");
    setText("autoPriceLabel","—");
    toast("⚠️ تعذر حساب المسافة (تأكد من الإنترنت)");
  }
}

function setPickup(latlng){
  pickup = { lat: latlng.lat, lon: latlng.lng };
  pickupMarker?.remove();
  pickupMarker = L.marker(latlng).addTo(map).bindPopup("الانطلاق").openPopup();
  setText("pickupLabel", `${round1(latlng.lat)}, ${round1(latlng.lng)}`);
  const p = $("pickupText");
  if(p) p.value = `(${round1(latlng.lat)}, ${round1(latlng.lng)})`;
}

function setDropoff(latlng){
  dropoff = { lat: latlng.lat, lon: latlng.lng };
  dropoffMarker?.remove();
  dropoffMarker = L.marker(latlng).addTo(map).bindPopup("الوجهة").openPopup();
  setText("dropoffLabel", `${round1(latlng.lat)}, ${round1(latlng.lng)}`);
  const d = $("dropoffText");
  if(d) d.value = `(${round1(latlng.lat)}, ${round1(latlng.lng)})`;
}

async function locateMe(){
  if(!navigator.geolocation){
    toast("⚠️ جهازك لا يدعم GPS");
    return;
  }
  toast("📍 جاري تحديد موقعك…");
  navigator.geolocation.getCurrentPosition((pos)=>{
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const latlng = L.latLng(lat, lon);
    map.setView(latlng, 15);
    setPickup(latlng);
    updateDistanceAndPrice();
  }, ()=>{
    toast("⚠️ لم يتم الحصول على الموقع (فعّل GPS)");
  }, { enableHighAccuracy:true, timeout:12000 });
}

function initMap(){
  const el = $("map");
  if(!el) return;

  map = L.map("map").setView([18.0735, -15.9582], 12);

  // خريطة واضحة Google-like (CARTO Voyager)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 20
  }).addTo(map);

  map.on("click", async (e)=>{
    if(!pickup){
      setPickup(e.latlng);
      await updateDistanceAndPrice();
      return;
    }
    if(!dropoff){
      setDropoff(e.latlng);
      await updateDistanceAndPrice();
      return;
    }
    // ضغط ثالث: تصفير وبداية جديدة
    resetMapUI();
    setPickup(e.latlng);
  });

  $("resetMapBtn")?.addEventListener("click", resetMapUI);
  $("locateBtn")?.addEventListener("click", locateMe);

  resetMapUI();
}

/* ============== ADMIN UI ============== */
function renderAdmin(){
  $("adminApp").style.display = "block";
  $("adminListBox").style.display = "block";

  const list = $("adminTrips");
  const empty = $("emptyAdmin");
  let trips = loadTrips().sort((a,b)=>Number(b.id)-Number(a.id));

  if(adminFilter !== "all"){
    const mapF = {
      available: STATUS.AVAILABLE,
      accepted: STATUS.ACCEPTED,
      started: STATUS.STARTED,
      finished: STATUS.FINISHED,
      rejected: STATUS.REJECTED
    };
    trips = trips.filter(t=>t.status === mapF[adminFilter]);
  }

  list.innerHTML = "";
  if(trips.length===0){ empty.style.display="block"; return; }
  empty.style.display="none";

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
      handleAction(b.dataset.id, b.dataset.a);
    });
    list.appendChild(div);
  });
}

function handleAction(id, action){
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
    if(trips[i].status!==STATUS.ACCEPTED && trips[i].status!==STATUS.STARTED){
      toast("⚠️ لازم يكون مقبول أولاً");
      return;
    }
    trips[i].status = STATUS.STARTED;
  }

  if(action==="finish"){
    if(trips[i].status!==STATUS.STARTED){
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
  const name = ($("custName").value||"").trim();
  const phone = ($("custPhone").value||"").trim();
  const pickupText = ($("pickupText").value||"").trim();
  const dropoffText = ($("dropoffText").value||"").trim();
  const priceOld = Number(($("priceOld").value||"900").trim()) || 900;
  const note = ($("note").value||"").trim();

  if(!name || !phone || !pickupText || !dropoffText){
    toast("⚠️ عبّي كل الحقول");
    return;
  }

  // المسافة إذا محسوبة
  let distanceKm = null;
  const distLabel = $("distanceLabel")?.textContent || "";
  if(distLabel.includes("كم")){
    // ما نعتمد parsing، نخزن من حالة pickup/dropoff
    // (لو عندك حاب، نخزن آخر قيمة من updateDistanceAndPrice؛ هنا نبقيها بسيطة)
  }
  // نخزن distanceKm مباشرة من route (إذا كان موجود)
  // بما أننا نحسب عبر updateDistanceAndPrice فقط عند وجود نقطتين:
  // نعيد طلب route سريعًا إذا كانت نقطتين موجودة
  const addTrip = async ()=>{
    let dist = null;
    if(pickup && dropoff){
      try{
        const out = await fetchRoute(pickup, dropoff);
        dist = out.km;
      }catch{}
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
      captainName: "",
      distanceKm: dist
    });
    saveTrips(trips);

    $("custName").value = "";
    $("custPhone").value = "";
    $("note").value = "";
    toast("✅ تم إرسال المشوار");
    renderAdmin();
  };

  addTrip();
}

function setupUI(){
  $("createTripBtn")?.addEventListener("click", createTrip);
  $("clearAllBtn")?.addEventListener("click", ()=>{
    if(!confirm("حذف كل المشاوير؟")) return;
    saveTrips([]);
    toast("تم حذف الكل");
    renderAdmin();
  });
  $("refreshBtn")?.addEventListener("click", renderAdmin);

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
    initMap();
    setupUI();
    renderAdmin();
  }
});
