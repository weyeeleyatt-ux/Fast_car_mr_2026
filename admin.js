const ADMIN_PASSWORD = "Fastcaradmin2026";
const AUTH_KEY_ADMIN = "fastcar_auth_admin_v1";
const STORE_KEY = "fastcar_shared_trips_v1";

const MIN_PRICE = 900;
const RATE_PER_KM = 300;

let map, pickupMarker, dropoffMarker, routeLine;
let pickup = null, dropoff = null;

function $(id){ return document.getElementById(id); }

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> t.style.display="none", 2200);
}

function isAuthed(){ return sessionStorage.getItem(AUTH_KEY_ADMIN) === "1"; }
function setAuthed(ok){ sessionStorage.setItem(AUTH_KEY_ADMIN, ok ? "1" : "0"); }

function loadTrips(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)||"[]"); } catch { return []; }
}
function saveTrips(trips){ localStorage.setItem(STORE_KEY, JSON.stringify(trips)); }

function round1(n){ return Math.round(n*10)/10; }
function calcPrice(km){ return Math.max(MIN_PRICE, Math.round(km * RATE_PER_KM)); }

function setupAuth(){
  $("logoutBtn").addEventListener("click", ()=>{ setAuthed(false); location.reload(); });

  if(isAuthed()){
    $("lockBox").style.display="none";
    $("adminApp").style.display="block";
    setTimeout(()=>{ initMap(); }, 250);
    return;
  }

  $("loginBtn").addEventListener("click", ()=>{
    const p = ($("passInput").value||"").trim();
    if(p.toLowerCase() === ADMIN_PASSWORD.toLowerCase()){
      setAuthed(true);
      location.reload();
    } else {
      $("lockMsg").style.display="block";
      $("lockMsg").textContent="❌ كلمة السر غير صحيحة";
    }
  });
}

function forceMapFix(){
  if(!map) return;
  try { map.invalidateSize(true); } catch {}
}

function initMap(){
  map = L.map("map").setView([18.07,-15.95], 13);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 20,
    attribution: "Tiles © Esri"
  }).addTo(map);

  setTimeout(forceMapFix, 200);
  setTimeout(forceMapFix, 700);
  setTimeout(forceMapFix, 1400);

  map.on("click", async (e)=>{
    if(!pickup){
      pickup = e.latlng;
      pickupMarker?.remove();
      pickupMarker = L.marker(pickup).addTo(map).bindPopup("الانطلاق").openPopup();
      $("pickupLabel").textContent = `${round1(pickup.lat)}, ${round1(pickup.lng)}`;
      $("pickupText").value = `(${round1(pickup.lat)}, ${round1(pickup.lng)})`;
      return;
    }
    if(!dropoff){
      dropoff = e.latlng;
      dropoffMarker?.remove();
      dropoffMarker = L.marker(dropoff).addTo(map).bindPopup("الوجهة").openPopup();
      $("dropoffLabel").textContent = `${round1(dropoff.lat)}, ${round1(dropoff.lng)}`;
      $("dropoffText").value = `(${round1(dropoff.lat)}, ${round1(dropoff.lng)})`;
      await updateRoute();
      return;
    }
    resetMap();
    pickup = e.latlng;
    pickupMarker?.remove();
    pickupMarker = L.marker(pickup).addTo(map).bindPopup("الانطلاق").openPopup();
  });

  $("resetMapBtn").addEventListener("click", resetMap);
  $("locateBtn").addEventListener("click", locateMe);

  $("createTripBtn").addEventListener("click", createTrip);
  $("sendWaBtn").addEventListener("click", sendWhatsApp);
}

function resetMap(){
  pickup = null; dropoff = null;
  pickupMarker?.remove(); pickupMarker = null;
  dropoffMarker?.remove(); dropoffMarker = null;
  routeLine?.remove(); routeLine = null;
  $("pickupLabel").textContent = "غير محدد";
  $("dropoffLabel").textContent = "غير محدد";
  $("distanceLabel").textContent = "—";
  $("autoPriceLabel").textContent = "900";
  $("pickupText").value = "";
  $("dropoffText").value = "";
  $("priceOld").value = "900";
  forceMapFix();
}

async function locateMe(){
  if(!navigator.geolocation){
    toast("⚠️ لا يوجد GPS");
    return;
  }
  navigator.geolocation.getCurrentPosition((pos)=>{
    const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
    map.setView(ll, 16);
    pickup = ll;
    pickupMarker?.remove();
    pickupMarker = L.marker(pickup).addTo(map).bindPopup("الانطلاق").openPopup();
    $("pickupLabel").textContent = `${round1(pickup.lat)}, ${round1(pickup.lng)}`;
    $("pickupText").value = `(${round1(pickup.lat)}, ${round1(pickup.lng)})`;
    setTimeout(forceMapFix, 200);
  }, ()=> toast("⚠️ فعّل الموقع"), { enableHighAccuracy:true, timeout:12000 });
}

async function fetchRoute(p1, p2){
  const url = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  const data = await r.json();
  const rt = data?.routes?.[0];
  if(!rt) throw new Error("no_route");
  return { km: rt.distance/1000, geo: rt.geometry };
}

async function updateRoute(){
  if(!pickup || !dropoff) return;
  $("distanceLabel").textContent = "…";
  try{
    const out = await fetchRoute(pickup, dropoff);
    const km = out.km;
    const price = calcPrice(km);

    $("distanceLabel").textContent = `${round1(km)} كم`;
    $("autoPriceLabel").textContent = String(price);
    $("priceOld").value = String(price);

    routeLine?.remove();
    routeLine = L.geoJSON(out.geo).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding:[20,20] });
    setTimeout(forceMapFix, 200);
  }catch{
    $("distanceLabel").textContent = "تعذر";
    toast("⚠️ تعذر حساب المسافة (تأكد من الإنترنت)");
  }
}

function createTrip(){
  const name = ($("custName").value||"").trim();
  const phone = ($("custPhone").value||"").trim();
  const pu = ($("pickupText").value||"").trim();
  const dof = ($("dropoffText").value||"").trim();
  const price = Number(($("priceOld").value||"900").trim()) || 900;
  const note = ($("note").value||"").trim();

  if(!name || !phone || !pu || !dof){
    toast("⚠️ عبّي كل الحقول وحدد الانطلاق والوجهة");
    return;
  }

  const trips = loadTrips();
  trips.push({
    id: Date.now().toString(),
    customerName: name,
    customerPhone: phone,
    pickupText: pu,
    dropoffText: dof,
    priceOld: price,
    note: note,
    status: "متوفر",
    captainName: ""
  });
  saveTrips(trips);
  toast("✅ تم إرسال المشوار");
}

function buildMessage(){
  const name = ($("custName").value||"").trim();
  const phone = ($("custPhone").value||"").trim();
  const pu = ($("pickupText").value||"").trim();
  const dof = ($("dropoffText").value||"").trim();
  const price = ($("priceOld").value||"900").trim();
  const note = ($("note").value||"").trim();

  return `🚗 مشوار جديد - Fast Car MR
👤 الزبون: ${name}
📞 الرقم: ${phone}
📍 الانطلاق: ${pu}
🎯 الوجهة: ${dof}
💰 السعر: ${price} أوقية قديمة
${note ? `📝 ملاحظة: ${note}` : ""}`.trim();
}

function sendWhatsApp(){
  const nums = ($("waNumbers").value||"").split(",").map(x=>x.trim()).filter(Boolean);
  if(nums.length === 0){
    toast("⚠️ اكتب أرقام واتساب أولاً");
    return;
  }
  const msg = buildMessage();

  // انسخ الرسالة تلقائيًا
  navigator.clipboard?.writeText(msg).catch(()=>{});

  // افتح أول رقم
  const url = `https://wa.me/${nums[0]}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
  toast("✅ فتح واتساب + تم نسخ الرسالة");
}

window.addEventListener("DOMContentLoaded", setupAuth);
