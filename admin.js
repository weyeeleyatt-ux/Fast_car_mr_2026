/***********************
  Fast Car MR - ADMIN
  LocalStorage Version (FAST FIX)
***********************/

const ADMIN_PASSWORD = "Fastcaradmin2026";
const ADMIN_SESSION_KEY = "fastcar_admin_session_v1";

const TRIPS_KEY = "fastcar_trips_v1";
const CAPTAINS_KEY = "fastcar_captains_v1";

const PRICE_PER_KM_OLD = 300; // 900 لكل 3 كم => 300 لكل 1 كم
const NOUAKCHOTT = { lat: 18.0735, lng: -15.9582 };

let map, fromMarker, toMarker, line;
let fromLatLng = null;
let toLatLng = null;
let activeFilter = "all";

function $(id){ return document.getElementById(id); }
function toast(msg){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.style.display="block";
  clearTimeout(window.__t);
  window.__t=setTimeout(()=>t.style.display="none",2500);
}

function showAdminMsg(msg){
  const m = $("adminMsg");
  m.style.display="block";
  m.textContent = msg;
}
function hideAdminMsg(){
  const m = $("adminMsg");
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

function setAuthed(on){
  $("lockBox").style.display = on ? "none" : "block";
  $("app").style.display = on ? "block" : "none";
}

function isAuthed(){
  return localStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

function kmDistance(a,b){
  // haversine
  const R = 6371;
  const dLat = (b.lat-a.lat) * Math.PI/180;
  const dLon = (b.lng-a.lng) * Math.PI/180;
  const la1 = a.lat * Math.PI/180;
  const la2 = b.lat * Math.PI/180;
  const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  return R*c;
}

function calcPriceOld(km){
  return Math.round(km * PRICE_PER_KM_OLD);
}

function updateRouteUI(){
  $("fromCoord").value = fromLatLng ? `${fromLatLng.lat.toFixed(6)}, ${fromLatLng.lng.toFixed(6)}` : "غير محدد";
  $("toCoord").value   = toLatLng ? `${toLatLng.lat.toFixed(6)}, ${toLatLng.lng.toFixed(6)}` : "غير محدد";

  if(fromLatLng && toLatLng){
    const km = kmDistance(fromLatLng, toLatLng);
    const price = calcPriceOld(km);
    $("priceOld").value = String(price);

    if(line) map.removeLayer(line);
    line = L.polyline([fromLatLng, toLatLng], { weight: 5 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding:[20,20] });
  }else{
    $("priceOld").value = "—";
    if(line){ map.removeLayer(line); line=null; }
  }
}

function resetMap(){
  fromLatLng = null;
  toLatLng = null;
  if(fromMarker){ map.removeLayer(fromMarker); fromMarker=null; }
  if(toMarker){ map.removeLayer(toMarker); toMarker=null; }
  updateRouteUI();
}

function initMap(){
  map = L.map("map", { zoomControl:true }).setView([NOUAKCHOTT.lat, NOUAKCHOTT.lng], 12);

  // ✅ Tiles واضحة (OpenStreetMap Standard) - أفضل وضوح
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  map.on("click", (e)=>{
    if(!fromLatLng){
      fromLatLng = { lat:e.latlng.lat, lng:e.latlng.lng };
      fromMarker = L.marker(e.latlng).addTo(map).bindPopup("الانطلاقة").openPopup();
      toast("✅ تم تحديد الانطلاقة");
    }else if(!toLatLng){
      toLatLng = { lat:e.latlng.lat, lng:e.latlng.lng };
      toMarker = L.marker(e.latlng).addTo(map).bindPopup("الوجهة").openPopup();
      toast("✅ تم تحديد الوجهة");
    }else{
      toast("ℹ️ اضغط (تصفير المواقع) لتحديد من جديد");
    }
    updateRouteUI();
  });

  // يحل مشكلة “خريطة رمادية” إذا كانت داخل عنصر مخفي سابقاً
  setTimeout(()=>map.invalidateSize(), 300);
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

function renderAdmin(){
  const all = loadTrips().sort((a,b)=>b.created_at - a.created_at);

  // KPIs
  const avail = all.filter(t=>t.status==="available").length;
  const run   = all.filter(t=>t.status==="accepted"||t.status==="started").length;
  const done  = all.filter(t=>t.status==="finished").length;

  $("kAll").textContent = String(all.length);
  $("kAvail").textContent = String(avail);
  $("kRun").textContent = String(run);
  $("kDone").textContent = String(done);

  const list = $("adminTrips");
  list.innerHTML = "";

  const filtered = (activeFilter==="all") ? all : all.filter(t=>t.status===activeFilter);

  $("emptyAdmin").style.display = filtered.length ? "none" : "block";

  for(const t of filtered){
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div><b>${t.customer_name || "بدون اسم"}</b> <span class="muted">(${t.customer_phone||"-"})</span></div>
        <div class="badge ${t.status}">${tripStatusBadge(t.status)}</div>
      </div>
      <div class="itemGrid">
        <div>
          <div class="muted">الانطلاقة</div>
          <div>${t.from_text || "-"}</div>
          <div class="muted">${t.from_lat ? (t.from_lat.toFixed(6)+", "+t.from_lng.toFixed(6)) : "-"}</div>
        </div>
        <div>
          <div class="muted">الوجهة</div>
          <div>${t.to_text || "-"}</div>
          <div class="muted">${t.to_lat ? (t.to_lat.toFixed(6)+", "+t.to_lng.toFixed(6)) : "-"}</div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="itemGrid">
        <div><div class="muted">المسافة</div><b>${t.distance_km ? t.distance_km.toFixed(2)+" كم" : "-"}</b></div>
        <div><div class="muted">السعر</div><b>${t.price_old ?? "-"} أوقية قديمة</b></div>
      </div>
      <div class="muted" style="margin-top:8px">
        الكابتن: <b>${t.captain_name || "-"}</b> | كود: <b>${t.captain_code || "-"}</b>
      </div>
      <div class="btnRow">
        <button class="btn ghost small" data-act="wa" data-id="${t.id}">واتساب الزبون</button>
        <button class="btn danger small" data-act="del" data-id="${t.id}">حذف</button>
      </div>
    `;
    list.appendChild(div);
  }

  // actions
  list.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      if(act==="del") return deleteTrip(id);
      if(act==="wa") return whatsappCustomer(id);
    });
  });
}

function deleteTrip(id){
  const all = loadTrips();
  const next = all.filter(x=>String(x.id)!==String(id));
  saveTrips(next);
  toast("✅ تم الحذف");
  renderAdmin();
}

function clearAll(){
  if(!confirm("أكيد حذف كل المشاوير؟")) return;
  saveTrips([]);
  toast("✅ تم حذف الكل");
  renderAdmin();
}

function whatsappLink(phone, text){
  const clean = String(phone||"").replace(/[^\d+]/g,"");
  const msg = encodeURIComponent(text || "");
  // wa.me أفضل
  return `https://wa.me/${clean}?text=${msg}`;
}

function whatsappDraftText(){
  const name = ($("custName").value || "").trim();
  const phone = ($("custPhone").value || "").trim();
  const fromT = ($("fromText").value || "").trim();
  const toT   = ($("toText").value || "").trim();
  const price = $("priceOld").value;
  return `Fast Car MR 🚗
الزبون: ${name}
الهاتف: ${phone}
من: ${fromT}
إلى: ${toT}
السعر: ${price} أوقية قديمة`;
}

function whatsappCustomer(tripId){
  const t = loadTrips().find(x=>String(x.id)===String(tripId));
  if(!t) return;
  const text = `Fast Car MR 🚗
تم تسجيل طلبك.
من: ${t.from_text||"-"}
إلى: ${t.to_text||"-"}
السعر: ${t.price_old} أوقية قديمة`;
  const url = whatsappLink(t.customer_phone, text);
  window.open(url, "_blank");
}

function openWhatsAppFromForm(){
  const phone = ($("custPhone").value || "").trim();
  if(!phone) return toast("اكتب رقم الزبون أولاً");
  const url = whatsappLink(phone, whatsappDraftText());
  window.open(url, "_blank");
}

function createTrip(){
  const customer_name = ($("custName").value||"").trim();
  const customer_phone = ($("custPhone").value||"").trim();
  const from_text = ($("fromText").value||"").trim();
  const to_text = ($("toText").value||"").trim();
  const note = ($("note").value||"").trim();
  const targetCaptainCode = ($("targetCaptainCode").value||"").trim().toUpperCase();

  if(!customer_name || !customer_phone) return toast("اكتب اسم الزبون + رقم الزبون");
  if(!from_text || !to_text) return toast("اكتب الانطلاقة + الوجهة");
  if(!fromLatLng || !toLatLng) return toast("حدد الانطلاقة والوجهة على الخريطة");

  const km = kmDistance(fromLatLng, toLatLng);
  const price_old = calcPriceOld(km);

  const trip = {
    id: String(Date.now()),
    created_at: Date.now(),
    customer_name,
    customer_phone,
    from_text,
    to_text,
    note,
    from_lat: fromLatLng.lat,
    from_lng: fromLatLng.lng,
    to_lat: toLatLng.lat,
    to_lng: toLatLng.lng,
    distance_km: km,
    price_old,
    status: "available",
    captain_code: null,
    captain_name: null,
    target_captain_code: targetCaptainCode || null
  };

  const all = loadTrips();
  all.push(trip);
  saveTrips(all);

  toast("✅ تم إرسال المشوار (سيظهر للكباتن)");
  renderAdmin();
}

function topupCaptain(){
  const code = ($("topupCode").value||"").trim().toUpperCase();
  const amt = Number(($("topupAmount").value||"").trim());

  if(!code) return toast("اكتب كود الكابتن");
  if(!Number.isFinite(amt) || amt<=0) return toast("اكتب مبلغ صحيح");

  const caps = loadCaptains();
  const c = caps.find(x=>String(x.code).toUpperCase()===code);
  if(!c) return toast("❌ الكابتن غير موجود على هذا الجهاز");
  c.points = Number(c.points||0) + amt;
  saveCaptains(caps);
  toast("✅ تم شحن الرصيد");
}

function initFilters(){
  document.querySelectorAll(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      activeFilter = ch.getAttribute("data-filter");
      renderAdmin();
    });
  });
}

window.addEventListener("DOMContentLoaded", ()=>{
  // auth
  $("adminLoginBtn").addEventListener("click", ()=>{
    hideAdminMsg();
    const p = ($("adminPass").value||"").trim();
    if(p !== ADMIN_PASSWORD){
      return showAdminMsg("❌ كلمة السر غير صحيحة");
    }
    localStorage.setItem(ADMIN_SESSION_KEY, "1");
    setAuthed(true);
    setTimeout(()=>map && map.invalidateSize(), 250);
  });

  $("logoutBtn").addEventListener("click",(e)=>{
    e.preventDefault();
    localStorage.removeItem(ADMIN_SESSION_KEY);
    location.reload();
  });

  setAuthed(isAuthed());

  initMap();
  initFilters();

  $("resetMapBtn").addEventListener("click", resetMap);
  $("createTripBtn").addEventListener("click", createTrip);
  $("refreshBtn").addEventListener("click", renderAdmin);
  $("clearAllBtn").addEventListener("click", clearAll);
  $("waBtn").addEventListener("click", openWhatsAppFromForm);
  $("topupBtn").addEventListener("click", topupCaptain);

  renderAdmin();
});
