const SUPABASE_URL = "PASTE_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_KEY_HERE";

const SESSION_KEY = "fastcar_captain_session_v3";
const FEE_PERCENT = 0.07;

let supa = null;
let cap = null;
let capFilter = "متوفر";

function $(id){ return document.getElementById(id); }
function toast(msg){
  const t = $("toast"); if(!t){ alert(msg); return; }
  t.textContent = msg; t.style.display="block";
  clearTimeout(window.__t); window.__t=setTimeout(()=>t.style.display="none",2300);
}
function round1(n){ return Math.round(n*10)/10; }

async function loadScript(src){
  await new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=src; s.async=true; s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}

async function initSupabase(){
  if(!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function saveSession(id){ localStorage.setItem(SESSION_KEY, id); }
function loadSession(){ return localStorage.getItem(SESSION_KEY); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

function setAuthed(on){
  $("capLockBox").style.display = on ? "none":"block";
  $("capApp").style.display = on ? "block":"none";
}

function esc(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function showLockMsg(msg){
  $("capLockMsg").style.display="block";
  $("capLockMsg").textContent=msg;
}

async function loadCaptainById(id){
  const { data, error } = await supa.from("captains").select("*").eq("id", id).single();
  if(error) return null;
  return data;
}

function fillProfile(){
  $("fullName").value = cap.full_name || "";
  $("carType").value = cap.car_type || "";
  $("carColor").value = cap.car_color || "";
  $("plate").value = cap.plate || "";
  $("bal").textContent = String(cap.balance_old || 0);
}

async function registerCaptain(){
  const phone = ($("capPhone").value||"").trim();
  const pin = ($("capPin").value||"").trim();
  if(!phone || !pin) return showLockMsg("⚠️ اكتب رقم + PIN");

  const full_name = (prompt("اكتب اسمك الكامل")||"").trim();
  if(!full_name) return showLockMsg("⚠️ الاسم مطلوب");

  const { data: exists } = await supa.from("captains").select("id").eq("phone", phone).maybeSingle();
  if(exists) return showLockMsg("⚠️ هذا الرقم مسجل مسبقًا");

  const { data, error } = await supa
    .from("captains")
    .insert({ phone, pin, full_name, balance_old: 0 })
    .select("*").single();

  if(error){ console.error(error); return showLockMsg("❌ فشل التسجيل"); }

  cap = data;
  saveSession(cap.id);
  setAuthed(true);
  fillProfile();
  toast("✅ تم إنشاء الحساب");
  renderTrips();
}

async function loginCaptain(){
  const phone = ($("capPhone").value||"").trim();
  const pin = ($("capPin").value||"").trim();
  if(!phone || !pin) return showLockMsg("⚠️ اكتب رقم + PIN");

  const { data, error } = await supa.from("captains").select("*").eq("phone", phone).maybeSingle();
  if(error){ console.error(error); return showLockMsg("❌ خطأ"); }
  if(!data) return showLockMsg("⚠️ الحساب غير موجود");
  if(String(data.pin) !== String(pin)) return showLockMsg("❌ PIN خطأ");

  cap = data;
  saveSession(cap.id);
  setAuthed(true);
  fillProfile();
  toast("✅ تم الدخول");
  renderTrips();
}

async function saveProfile(){
  const payload = {
    full_name: ($("fullName").value||"").trim(),
    car_type: ($("carType").value||"").trim() || null,
    car_color: ($("carColor").value||"").trim() || null,
    plate: ($("plate").value||"").trim() || null
  };
  if(!payload.full_name) return toast("⚠️ الاسم مطلوب");

  const { error } = await supa.from("captains").update(payload).eq("id", cap.id);
  if(error){ console.error(error); return toast("❌ فشل الحفظ"); }

  cap = await loadCaptainById(cap.id);
  fillProfile();
  toast("✅ تم حفظ البروفايل");
}

function matchesFilter(t){
  if(capFilter==="all") return true;
  return t.status === capFilter;
}

async function renderTrips(){
  const list = $("capTrips");
  const empty = $("capEmpty");

  const { data, error } = await supa.from("trips").select("*").order("created_at",{ascending:false});
  if(error){ console.error(error); return toast("❌ فشل تحميل المشاوير"); }

  const trips = (data||[]).filter(matchesFilter);

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
          <div class="meta">الانطلاق: ${esc(t.pickup_text)}<br>الوجهة: ${esc(t.dropoff_text)}</div>
          <div class="meta">المسافة: <b>${dist}</b> • السعر: <b>${t.price_old}</b> أوقية قديمة</div>
          ${t.captain_name ? `<div class="meta">الكابتن: <b>${esc(t.captain_name)}</b></div>`:""}
        </div>
        <span class="badge">${esc(t.status)}</span>
      </div>
      <div class="actions">
        <button class="ok" data-a="accept" data-id="${t.id}">أقبل</button>
        <button class="bad" data-a="reject" data-id="${t.id}">أرفض</button>
        <button data-a="start" data-id="${t.id}">بدأ</button>
        <button class="bad" data-a="finish" data-id="${t.id}">انتهى + خصم 7%</button>
        <button data-a="call" data-phone="${esc(t.customer_phone)}">اتصال</button>
      </div>
    `;
    div.addEventListener("click",(e)=>{
      const b = e.target.closest("button");
      if(!b) return;

      if(b.dataset.a==="call"){
        const p=b.dataset.phone||""; if(p) location.href=`tel:${p}`;
        return;
      }
      updateTrip(b.dataset.id, b.dataset.a);
    });
    list.appendChild(div);
  }
}

async function updateTrip(tripId, action){
  const { data: trip, error: e1 } = await supa.from("trips").select("*").eq("id", tripId).single();
  if(e1){ console.error(e1); return toast("❌ خطأ"); }

  if(action==="accept"){
    if(trip.status !== "متوفر") return toast("⚠️ المشوار غير متوفر");
    const { error } = await supa.from("trips").update({
      status:"مقبول", captain_id: cap.id, captain_name: cap.full_name
    }).eq("id", tripId);
    if(error){ console.error(error); return toast("❌ فشل"); }
    toast("✅ تم القبول"); return renderTrips();
  }

  if(action==="reject"){
    const { error } = await supa.from("trips").update({
      status:"مرفوض", captain_id: cap.id, captain_name: cap.full_name
    }).eq("id", tripId);
    if(error){ console.error(error); return toast("❌ فشل"); }
    toast("✅ تم الرفض"); return renderTrips();
  }

  if(action==="start"){
    if(trip.status !== "مقبول") return toast("⚠️ لازم يكون مقبول أولًا");
    const { error } = await supa.from("trips").update({ status:"بدأ" }).eq("id", tripId);
    if(error){ console.error(error); return toast("❌ فشل"); }
    toast("✅ بدأ المشوار"); return renderTrips();
  }

  if(action==="finish"){
    if(trip.status !== "بدأ") return toast("⚠️ لازم يكون بدأ أولًا");

    const fee = Math.ceil((Number(trip.price_old||0)) * FEE_PERCENT);
    const newBal = Math.max(0, (cap.balance_old||0) - fee);

    const { error: e2 } = await supa.from("trips").update({ status:"انتهى" }).eq("id", tripId);
    if(e2){ console.error(e2); return toast("❌ فشل إنهاء"); }

    const { error: e3 } = await supa.from("captains").update({ balance_old: newBal }).eq("id", cap.id);
    if(e3){ console.error(e3); return toast("❌ فشل خصم الرصيد"); }

    await supa.from("wallet_tx").insert({ captain_id: cap.id, type:"fee", amount_old: -fee, note:`fee 7% trip ${tripId}` });

    cap = await loadCaptainById(cap.id);
    fillProfile();

    toast(`✅ انتهى + خصم ${fee} أوقية`);
    return renderTrips();
  }
}

function setupFilters(){
  document.querySelectorAll(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");
      capFilter = ch.dataset.filter || "متوفر";
      renderTrips();
    });
  });
}

window.addEventListener("DOMContentLoaded", async ()=>{
  await initSupabase();

  $("logoutCapBtn").addEventListener("click", ()=>{ clearSession(); location.reload(); });

  $("capLoginBtn").addEventListener("click", loginCaptain);
  $("capRegisterBtn").addEventListener("click", registerCaptain);

  const sid = loadSession();
  if(sid){
    cap = await loadCaptainById(sid);
    if(cap){
      setAuthed(true);
      fillProfile();

      $("saveProfileBtn").addEventListener("click", saveProfile);
      $("capRefreshBtn").addEventListener("click", renderTrips);
      setupFilters();
      renderTrips();

      try{
        supa.channel("trips_changes")
          .on("postgres_changes", { event:"*", schema:"public", table:"trips" }, ()=> renderTrips())
          .subscribe();
      }catch{}
      return;
    }
    clearSession();
  }

  setAuthed(false);
});
