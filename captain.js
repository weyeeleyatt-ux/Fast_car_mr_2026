/***********************
  Fast Car MR - Captain
  FILE: captain.js
***********************/

// ✅ ضع مفاتيح Supabase هنا
const SUPABASE_URL = "PASTE_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_KEY_HERE";

// خصم 7% عند انتهاء المشوار
const FEE_PERCENT = 0.07;

// جلسة الكابتن على نفس الجهاز
const SESSION_KEY = "fastcar_captain_session_v4";

let supa = null;
let captain = null;
let filter = "متوفر";

function $(id){ return document.getElementById(id); }

function toast(msg){
  const t = $("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastTO);
  window.__toastTO = setTimeout(()=> t.style.display="none", 2200);
}

function showMsg(msg){
  const m = $("msg");
  if(!m){ alert(msg); return; }
  m.style.display = "block";
  m.textContent = msg;
}

function setAuthed(on){
  $("lockBox").style.display = on ? "none" : "block";
  $("app").style.display = on ? "block" : "none";
}

function esc(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function round1(n){ return Math.round(n*10)/10; }

async function loadScript(src){
  await new Promise((resolve,reject)=>{
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initSupabase(){
  if(!window.supabase){
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  }
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function saveSession(id){ localStorage.setItem(SESSION_KEY, id); }
function loadSession(){ return localStorage.getItem(SESSION_KEY); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

/* ===== Captain Code ===== */
function makeCaptainCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "FC-";
  for(let i=0;i<6;i++){
    out += chars[Math.floor(Math.random()*chars.length)];
  }
  return out;
}

/* ===== DB helpers ===== */
async function getCaptainById(id){
  const { data, error } = await supa.from("captains").select("*").eq("id", id).single();
  if(error) return null;
  return data;
}

function fillCaptainUI(){
  $("code").value = captain.code || "";
  $("profileName").value = captain.full_name || "";
  $("points").textContent = String(captain.points || 0);
}

/* ===== Register ===== */
async function registerCaptain(){
  const full_name = ($("name").value || "").trim();
  const phone = ($("phone").value || "").trim();
  const pass = ($("pass").value || "").trim();

  if(!full_name || !phone || !pass){
    return showMsg("⚠️ اكتب الاسم + الرقم + كلمة السر");
  }

  // هل الرقم موجود؟
  const { data: exists, error: e0 } = await supa.from("captains").select("id").eq("phone", phone).maybeSingle();
  if(e0){ console.error(e0); return showMsg("❌ خطأ"); }
  if(exists) return showMsg("⚠️ هذا الرقم مسجل مسبقاً");

  // اصنع كود فريد
  let code = makeCaptainCode();
  for(let i=0;i<6;i++){
    const { data: c } = await supa.from("captains").select("id").eq("code", code).maybeSingle();
    if(!c) break;
    code = makeCaptainCode();
  }

  const { data, error } = await supa
    .from("captains")
    .insert({ code, full_name, phone, pass, points: 0 })
    .select("*")
    .single();

  if(error){ console.error(error); return showMsg("❌ فشل التسجيل"); }

  captain = data;
  saveSession(captain.id);
  setAuthed(true);
  fillCaptainUI();
  toast("✅ تم إنشاء الحساب");
  await renderTrips();
}

/* ===== Login ===== */
async function loginCaptain(){
  const phone = ($("phone").value || "").trim();
  const pass = ($("pass").value || "").trim();

  if(!phone || !pass){
    return showMsg("⚠️ اكتب الرقم + كلمة السر");
  }

  const { data, error } = await supa.from("captains").select("*").eq("phone", phone).maybeSingle();
  if(error){ console.error(error); return showMsg("❌ خطأ"); }
  if(!data) return showMsg("⚠️ الحساب غير موجود");
  if(String(data.pass) !== String(pass)) return showMsg("❌ كلمة السر غلط");

  captain = data;
  saveSession(captain.id);
  setAuthed(true);
  fillCaptainUI();
  toast("✅ تم الدخول");
  await renderTrips();
}

/* ===== Save profile ===== */
async function saveProfile(){
  const name = ($("profileName").value || "").trim();
  if(!name) return toast("⚠️ الاسم مطلوب");

  const { error } = await supa.from("captains").update({ full_name: name }).eq("id", captain.id);
  if(error){ console.error(error); return toast("❌ فشل حفظ الاسم"); }

  captain = await getCaptainById(captain.id);
  fillCaptainUI();
  toast("✅ تم حفظ الاسم");
}

/* ===== Trips ===== */
function matchesFilter(t){
  if(filter === "all") return true;
  return t.status === filter;
}

async function renderTrips(){
  const list = $("list");
  const empty = $("empty");

  const { data, error } = await supa.from("trips").select("*").order("created_at", { ascending:false });
  if(error){ console.error(error); return toast("❌ فشل تحميل المشاوير"); }

  const trips = (data || []).filter(matchesFilter);

  list.innerHTML = "";
  if(trips.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for(const t of trips){
    const dist = (t.distance_km != null) ? `${round1(t.distance_km)} كم` : "—";

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="itemTop">
        <div>
          <b>${esc(t.customer_name)}</b> • ${esc(t.customer_phone)}
          <div class="meta">الانطلاقة: ${esc(t.pickup_text)}<br>الوجهة: ${esc(t.dropoff_text)}</div>
          <div class="meta">المسافة: <b>${dist}</b> • السعر: <b>${t.price_old}</b> أوقية قديمة</div>
          ${t.captain_name ? `<div class="meta">الكابتن: <b>${esc(t.captain_name)}</b></div>` : ""}
        </div>
        <span class="badge">${esc(t.status)}</span>
      </div>

      <div class="actions">
        <button class="ok" data-a="accept" data-id="${t.id}">أقبل</button>
        <button class="bad" data-a="reject" data-id="${t.id}">أرفض</button>
        <button data-a="start" data-id="${t.id}">بدأ</button>
        <button class="bad" data-a="finish" data-id="${t.id}">انتهى (خصم 7%)</button>
        <button data-a="call" data-phone="${esc(t.customer_phone)}">اتصال</button>
      </div>
    `;

    item.addEventListener("click", async (e)=>{
      const b = e.target.closest("button");
      if(!b) return;

      const action = b.dataset.a;
      if(action === "call"){
        const p = b.dataset.phone || "";
        if(p) location.href = `tel:${p}`;
        return;
      }

      const id = b.dataset.id;
      if(!id) return;

      await updateTripStatus(id, action);
    });

    list.appendChild(item);
  }
}

/* ===== Update trip status ===== */
async function updateTripStatus(tripId, action){
  const { data: trip, error: e1 } = await supa.from("trips").select("*").eq("id", tripId).single();
  if(e1){ console.error(e1); return toast("❌ خطأ"); }

  if(action === "accept"){
    if(trip.status !== "متوفر") return toast("⚠️ المشوار غير متوفر");
    const { error } = await supa.from("trips").update({
      status: "مقبول",
      captain_id: captain.id,
      captain_name: captain.full_name
    }).eq("id", tripId);
    if(error){ console.error(error); return toast("❌ فشل"); }
    toast("✅ تم القبول");
    return renderTrips();
  }

  if(action === "reject"){
    const { error } = await supa.from("trips").update({
      status: "مرفوض",
      captain_id: captain.id,
      captain_name: captain.full_name
    }).eq("id", tripId);
    if(error){ console.error(error); return toast("❌ فشل"); }
    toast("✅ تم الرفض");
    return renderTrips();
  }

  if(action === "start"){
    if(trip.status !== "مقبول") return toast("⚠️ لازم يكون مقبول أولاً");
    const { error } = await supa.from("trips").update({ status:"بدأ" }).eq("id", tripId);
    if(error){ console.error(error); return toast("❌ فشل"); }
    toast("✅ بدأ المشوار");
    return renderTrips();
  }

  if(action === "finish"){
    if(trip.status !== "بدأ") return toast("⚠️ لازم يكون بدأ أولاً");

    const fee = Math.ceil((Number(trip.price_old || 0)) * FEE_PERCENT);
    if((captain.points || 0) < fee){
      return toast(`⚠️ نقاطك غير كافية. لازم ${fee} نقطة لإنهاء المشوار`);
    }

    // أنهِ المشوار
    const { error: e2 } = await supa.from("trips").update({ status:"انتهى" }).eq("id", tripId);
    if(e2){ console.error(e2); return toast("❌ فشل إنهاء المشوار"); }

    // خصم النقاط
    const newPoints = (captain.points || 0) - fee;
    const { error: e3 } = await supa.from("captains").update({ points: newPoints }).eq("id", captain.id);
    if(e3){ console.error(e3); return toast("❌ فشل خصم النقاط"); }

    // سجل العملية
    await supa.from("points_tx").insert({
      captain_id: captain.id,
      type: "fee",
      amount: -fee,
      note: `fee 7% trip ${tripId}`
    });

    captain = await getCaptainById(captain.id);
    fillCaptainUI();
    toast(`✅ انتهى + خصم ${fee} نقطة`);
    return renderTrips();
  }
}

/* ===== Filters UI ===== */
function setupFilters(){
  document.querySelectorAll(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      filter = ch.dataset.filter || "متوفر";
      renderTrips();
    });
  });
}

/* ===== Realtime ===== */
function setupRealtime(){
  try{
    supa.channel("trips_changes_captain")
      .on("postgres_changes", { event:"*", schema:"public", table:"trips" }, async ()=>{
        await renderTrips();
        // حدث الرصيد (لو صار خصم/شحن)
        const fresh = await getCaptainById(captain.id);
        if(fresh){ captain = fresh; fillCaptainUI(); }
      })
      .subscribe();
  }catch{}
}

/* ===== Main ===== */
window.addEventListener("DOMContentLoaded", async ()=>{
  await initSupabase();

  $("logoutBtn")?.addEventListener("click", ()=>{
    clearSession();
    location.reload();
  });

  $("registerBtn")?.addEventListener("click", registerCaptain);
  $("loginBtn")?.addEventListener("click", loginCaptain);
  $("saveProfileBtn")?.addEventListener("click", saveProfile);
  $("refreshBtn")?.addEventListener("click", renderTrips);

  setupFilters();

  // auto login
  const sid = loadSession();
  if(sid){
    const c = await getCaptainById(sid);
    if(c){
      captain = c;
      setAuthed(true);
      fillCaptainUI();
      await renderTrips();
      setupRealtime();
      return;
    }
    clearSession();
  }

  setAuthed(false);
});
