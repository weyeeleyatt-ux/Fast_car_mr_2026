// ===== PASSWORDS =====
const ADMIN_PASSWORD = "Fastcaradmin2026";

// ===== PUT YOUR KEYS HERE =====
const SUPABASE_URL = "PASTE_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_KEY_HERE";
const GOOGLE_MAPS_API_KEY = "PASTE_GOOGLE_MAPS_KEY_HERE";

// ===== PRICING =====
// كل 3 كم = 900 أوقية قديمة
const STEP_KM = 3;
const STEP_PRICE_OLD = 900;

const AUTH_KEY_ADMIN = "fastcar_admin_auth_v1";

let supa = null;
let adminFilter = "all";

// Google Maps
let gmap, directionsService, directionsRenderer;
let pickupLatLng = null, dropoffLatLng = null;
let pickupMarker = null, dropoffMarker = null;
let lastDistanceKm = null;

function $(id){ return document.getElementById(id); }

function toast(msg){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__t);
  window.__t = setTimeout(()=> t.style.display="none", 2200);
}

function isAuthed(){ return sessionStorage.getItem(AUTH_KEY_ADMIN)==="1"; }
function setAuthed(ok){ sessionStorage.setItem(AUTH_KEY_ADMIN, ok ? "1":"0"); }

function round1(n){ return Math.round(n*10)/10; }

function calcPriceOld(km){
  const steps = Math.max(1, Math.ceil(km / STEP_KM));
  return steps * STEP_PRICE_OLD;
}

async function loadScript(src){
  await new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initSupabase(){
  if(!window.supabase){
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  }
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function initGoogle(){
  if(window.google?.maps) return;
  await loadScript(
    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&region=MR&language=ar`
  );
}

function setupAuth(){
  $("logoutBtn").addEventListener("click", ()=>{ setAuthed(false); location.reload(); });

  if(isAuthed()){
    $("lockBox").style.display="none";
    $("adminApp").style.display="block";
    $("adminListBox").style.display="block";
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

function resetMap(){
  pickupLatLng = null;
  dropoffLatLng = null;
  lastDistanceKm = null;

  if(pickupMarker){ pickupMarker.setMap(null); pickupMarker = null; }
  if(dropoffMarker){ dropoffMarker.setMap(null); dropoffMarker = null; }

  if(directionsRenderer){
    directionsRenderer.set("directions", null);
  }

  $("distanceLabel").textContent = "—";
  $("autoPriceLabel").textContent = String(STEP_PRICE_OLD);
  $("priceOld").value = String(STEP_PRICE_OLD);
}

function setPickup(ll){
  pickupLatLng = ll;
  if(pickupMarker) pickupMarker.setMap(null);
  pickupMarker = new google.maps.Marker({ map:gmap, position:ll, label:"A" });
}

function setDropoff(ll){
  dropoffLatLng = ll;
  if(dropoffMarker) dropoffMarker.setMap(null);
  dropoffMarker = new google.maps.Marker({ map:gmap, position:ll, label:"B" });
}

function setupAutocomplete(){
  const boundsNouakchott = new google.maps.LatLngBounds(
    new google.maps.LatLng(17.95, -16.15),
    new google.maps.LatLng(18.20, -15.85)
  );

  const ap = new google.maps.places.Autocomplete($("pickupText"), {
    bounds: boundsNouakchott,
    componentRestrictions: { country:"mr" },
    fields: ["geometry","name","formatted_address"]
  });

  const ad = new google.maps.places.Autocomplete($("dropoffText"), {
    bounds: boundsNouakchott,
    componentRestrictions: { country:"mr" },
    fields: ["geometry","name","formatted_address"]
  });

  ap.addListener("place_changed", ()=>{
    const p = ap.getPlace();
    if(!p?.geometry?.location) return;
    const ll = { lat:p.geometry.location.lat(), lng:p.geometry.location.lng() };
    setPickup(ll);
    gmap.panTo(ll);
    computeRoute();
  });

  ad.addListener("place_changed", ()=>{
    const p = ad.getPlace();
    if(!p?.geometry?.location) return;
    const ll = { lat:p.geometry.location.lat(), lng:p.geometry.location.lng() };
    setDropoff(ll);
    gmap.panTo(ll);
    computeRoute();
  });
}

function initMap(){
  gmap = new google.maps.Map(document.getElementById("map"), {
    center: { lat:18.0735, lng:-15.9582 }, // Nouakchott
    zoom: 12,
    mapTypeId: "roadmap",
    streetViewControl: false,
    fullscreenControl: true
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ map:gmap, suppressMarkers:true });

  setupAutocomplete();
  resetMap();

  gmap.addListener("click", (e)=>{
    const ll = { lat:e.latLng.lat(), lng:e.latLng.lng() };

    if(!pickupLatLng){
      setPickup(ll);
      $("pickupText").value = `${round1(ll.lat)}, ${round1(ll.lng)}`;
      return;
    }
    if(!dropoffLatLng){
      setDropoff(ll);
      $("dropoffText").value = `${round1(ll.lat)}, ${round1(ll.lng)}`;
      computeRoute();
      return;
    }
    resetMap();
    setPickup(ll);
    $("pickupText").value = `${round1(ll.lat)}, ${round1(ll.lng)}`;
  });

  $("resetMapBtn").addEventListener("click", resetMap);

  $("locateBtn").addEventListener("click", ()=>{
    if(!navigator.geolocation) return toast("⚠️ لا يوجد GPS");
    navigator.geolocation.getCurrentPosition((pos)=>{
      const ll = { lat:pos.coords.latitude, lng:pos.coords.longitude };
      gmap.setCenter(ll);
      gmap.setZoom(15);
      setPickup(ll);
      $("pickupText").value = `${round1(ll.lat)}, ${round1(ll.lng)}`;
    }, ()=>toast("⚠️ فعّل الموقع"), { enableHighAccuracy:true, timeout:12000 });
  });
}

function computeRoute(){
  if(!pickupLatLng || !dropoffLatLng) return;

  directionsService.route({
    origin: pickupLatLng,
    destination: dropoffLatLng,
    travelMode: google.maps.TravelMode.DRIVING
  }, (res, status)=>{
    if(status !== "OK" || !res?.routes?.[0]?.legs?.[0]){
      toast("⚠️ تعذر حساب الطريق");
      return;
    }

    directionsRenderer.setDirections(res);

    const leg = res.routes[0].legs[0];
    const km = (leg.distance?.value || 0)/1000;
    lastDistanceKm = km;

    const price = calcPriceOld(km);
    $("distanceLabel").textContent = `${round1(km)} كم`;
    $("autoPriceLabel").textContent = String(price);
    $("priceOld").value = String(price);
  });
}

function buildTripMessage(payload){
  return `🚗 مشوار جديد - Fast Car MR
الزبون: ${payload.customer_name}
رقم الزبون: ${payload.customer_phone}
الانطلاقة: ${payload.pickup_text}
الوجهة: ${payload.dropoff_text}
المسافة: ${payload.distance_km ? round1(payload.distance_km)+" كم" : "—"}
السعر: ${payload.price_old} أوقية قديمة
الحالة: ${payload.status}
${payload.note ? "ملاحظة: "+payload.note : ""}`.trim();
}

async function sendWhatsAppNow(payload){
  const to = ($("waNumber").value||"").trim();
  if(!to) return toast("⚠️ اكتب رقم واتساب للإرسال");

  const msg = buildTripMessage(payload);
  // يفتح واتساب
  const url = `https://wa.me/${encodeURIComponent(to)}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");

  // نسخ احتياطي
  try{ await navigator.clipboard.writeText(msg); }catch{}
}

async function createTrip(){
  const customer_name = ($("custName").value||"").trim();
  const customer_phone = ($("custPhone").value||"").trim();
  const pickup_text = ($("pickupText").value||"").trim();
  const dropoff_text = ($("dropoffText").value||"").trim();
  const note = ($("note").value||"").trim() || null;

  if(!customer_name || !customer_phone || !pickup_text || !dropoff_text){
    return toast("⚠️ عبّي كل الحقول");
  }
  if(!pickupLatLng || !dropoffLatLng){
    return toast("⚠️ لازم تحدد الانطلاقة والوجهة على الخريطة أو من الاقتراحات");
  }

  const price_old = Number(($("priceOld").value||"900").trim()) || 900;

  const payload = {
    customer_name,
    customer_phone,
    pickup_text,
    dropoff_text,
    pickup_lat: pickupLatLng.lat,
    pickup_lng: pickupLatLng.lng,
    dropoff_lat: dropoffLatLng.lat,
    dropoff_lng: dropoffLatLng.lng,
    distance_km: lastDistanceKm,
    price_old,
    note,
    status: "متوفر"
  };

  const { error } = await supa.from("trips").insert(payload);
  if(error){ console.error(error); return toast("❌ فشل حفظ المشوار"); }

  toast("✅ تم حفظ المشوار");
  // واتساب اختياري
  if(($("waNumber").value||"").trim()){
    await sendWhatsAppNow(payload);
  }

  $("custName").value="";
  $("custPhone").value="";
  $("note").value="";
  resetMap();
  renderAdminTrips();
}

function esc(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

async function renderAdminTrips(){
  const list = $("adminTrips");
  const empty = $("emptyAdmin");

  const { data, error } = await supa.from("trips").select("*").order("created_at",{ascending:false});
  if(error){ console.error(error); return toast("❌ فشل تحميل المشاوير"); }

  const trips = (data||[]).filter(t => adminFilter==="all" ? true : t.status===adminFilter);

  list.innerHTML="";
  if(trips.length===0){ empty.style.display="block"; return; }
  empty.style.display="none";

  for(const t of trips){
    const dist = (t.distance_km!=null) ? `${round1(t.distance_km)} كم` : "—";
    const div = document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <b>${esc(t.customer_name)}</b> • ${esc(t.customer_phone)}
          <div class="meta">الانطلاقة: ${esc(t.pickup_text)}<br>الوجهة: ${esc(t.dropoff_text)}</div>
          <div class="meta">المسافة: <b>${dist}</b> • السعر: <b>${t.price_old}</b> أوقية قديمة</div>
          ${t.captain_name ? `<div class="meta">الكابتن: <b>${esc(t.captain_name)}</b></div>`:""}
        </div>
        <span class="badge">${esc(t.status)}</span>
      </div>
      <div class="actions">
        <button class="bad" data-a="del" data-id="${t.id}">حذف</button>
      </div>
    `;
    div.addEventListener("click", async (e)=>{
      const b = e.target.closest("button");
      if(!b) return;
      if(b.dataset.a==="del"){
        const { error } = await supa.from("trips").delete().eq("id", b.dataset.id);
        if(error){ console.error(error); return toast("❌ فشل الحذف"); }
        toast("🗑️ تم الحذف");
        renderAdminTrips();
      }
    });
    list.appendChild(div);
  }
}

function setupFilters(){
  document.querySelectorAll(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      adminFilter = ch.dataset.filter || "all";
      renderAdminTrips();
    });
  });
}

async function topupPoints(){
  const code = ($("topupCode").value||"").trim();
  const pts = Number(($("topupPoints").value||"0").trim());
  if(!code || !pts || pts<=0) return toast("⚠️ اكتب كود + نقاط صحيحة");

  const { data: cap, error: e1 } = await supa.from("captains").select("*").eq("code", code).maybeSingle();
  if(e1){ console.error(e1); return toast("❌ خطأ"); }
  if(!cap) return toast("⚠️ الكابتن غير موجود");

  const newPts = (cap.points||0) + pts;
  const { error: e2 } = await supa.from("captains").update({ points: newPts }).eq("id", cap.id);
  if(e2){ console.error(e2); return toast("❌ فشل الشحن"); }

  await supa.from("points_tx").insert({ captain_id: cap.id, type:"topup", amount: pts, note:`topup by admin (${code})` });

  toast("✅ تم شحن النقاط");
  $("topupPoints").value="";
}

window.addEventListener("DOMContentLoaded", async ()=>{
  setupAuth();
  if(!isAuthed()) return;

  await initSupabase();
  await initGoogle();

  initMap();

  $("createTripBtn").addEventListener("click", createTrip);
  $("waBtn").addEventListener("click", async ()=>{
    // يبني رسالة من المدخلات الحالية حتى قبل الحفظ
    const payload = {
      customer_name: ($("custName").value||"").trim(),
      customer_phone: ($("custPhone").value||"").trim(),
      pickup_text: ($("pickupText").value||"").trim(),
      dropoff_text: ($("dropoffText").value||"").trim(),
      distance_km: lastDistanceKm,
      price_old: Number(($("priceOld").value||"900").trim()) || 900,
      note: ($("note").value||"").trim() || null,
      status: "متوفر"
    };
    if(!payload.customer_name || !payload.customer_phone || !payload.pickup_text || !payload.dropoff_text){
      return toast("⚠️ عبّي الحقول أولًا");
    }
    await sendWhatsAppNow(payload);
  });

  $("refreshBtn").addEventListener("click", renderAdminTrips);
  $("topupBtn").addEventListener("click", topupPoints);

  setupFilters();
  renderAdminTrips();

  // تحديث مباشر
  try{
    supa.channel("trips_changes")
      .on("postgres_changes", { event:"*", schema:"public", table:"trips" }, ()=> renderAdminTrips())
      .subscribe();
  }catch{}
});
