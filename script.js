const $ = (sel) => document.querySelector(sel);

let DATA = null;
let LANG = localStorage.getItem("bfl_lang") || "cs"; // CZ default
let FILTER = "all";
let SHOW_OCCUPIED = true;

// modal/gallery state
let ACTIVE_ROOM = null;
let GALLERY_INDEX = 0;

function t(en, cs){ return LANG === "cs" ? cs : en; }

function formatPriceCZK(n){
  const s = new Intl.NumberFormat("cs-CZ").format(n);
  return `${s} Kč`;
}

function formatDate(d){
  if(!d || d === "now") return t("Now", "Ihned");
  const [y,m,day] = d.split("-").map(x=>parseInt(x,10));
  const dt = new Date(y, m-1, day);
  return new Intl.DateTimeFormat(LANG === "cs" ? "cs-CZ" : "en-GB", { year:"numeric", month:"short", day:"2-digit" }).format(dt);
}

function statusLabelShort(r){
  if(r.status === "available") return t("Available now", "Volné nyní");
  if(r.status === "upcoming") return t(`From ${formatDate(r.available_from)}`, `Od ${formatDate(r.available_from)}`);
  return t("Occupied", "Obsazeno");
}

function roomStatusLabel(status, availableFrom){
  if(status === "available") return t("Available now", "Volné nyní");
  if(status === "upcoming") return t(`Available from ${formatDate(availableFrom)}`, `Volné od ${formatDate(availableFrom)}`);
  return t("Occupied (waitlist)", "Obsazeno (waitlist)");
}

function shouldShowRoom(r){
  if(r.status === "occupied" && !SHOW_OCCUPIED) return false;
  if(FILTER === "all") return true;
  return r.status === FILTER;
}

function applyUrlForRoom(roomId){
  const base = DATA?.contact?.apply_url || "";
  if(!base || base.includes("YOUR_FORM_URL_HERE")) return "#apply";
  const u = new URL(base);
  u.searchParams.set("room", roomId);
  return u.toString();
}

function roomCoverUrl(r){
  const folder = r.gallery_folder;
  const cover = r.cover || "cover.jpg";
  if(folder) return `${folder}/${cover}`;
  return "assets/img/placeholder.jpg";
}

/* ---------- Gallery from folder (jpg: cover + 1..10) ---------- */
function tryLoadImage(url){
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
async function buildGalleryFromFolder(folder){
  const out = [];
  const cover = `${folder}/cover.jpg`;
  if(await tryLoadImage(cover)) out.push(cover);
  for(let i=1;i<=10;i++){
    const u = `${folder}/${i}.jpg`;
    if(await tryLoadImage(u)) out.push(u);
  }
  if(!out.length) out.push("assets/img/placeholder.jpg");
  return out;
}

/* ---------- Cards ---------- */
function roomCard(r){
  const img = roomCoverUrl(r);
  const occ = (LANG === "cs" ? r.occupancy_cs : r.occupancy_en) || "";
  const title = (LANG === "cs" ? r.name_cs : r.name_en);

  return `
  <div class="card" data-room="${r.id}">
    <div class="cardImg" style="background-image:url('${img}')" aria-label="room image"></div>
    <div class="cardBody">
      <div class="cardTitle">
        <div>
          <strong>${title}</strong>
          <div class="meta">${r.size_m2} m² • ${occ} • ${t("All-inclusive","All-inclusive")}</div>
        </div>
        <div class="price">${t("from","od")} ${formatPriceCZK(r.price_from_czk)}</div>
      </div>

      <div class="status ${r.status}">${roomStatusLabel(r.status, r.available_from)}</div>
      <div class="meta">${LANG === "cs" ? r.summary_cs : r.summary_en}</div>

      <div class="cardActions">
        <button class="btn primary" data-action="open">${t("View details","Detail")}</button>
        <a class="btn" href="${applyUrlForRoom(r.id)}">${t("Apply","Poptat")}</a>
      </div>
    </div>
  </div>
  `;
}

function featuredCard(r){
  const img = roomCoverUrl(r);
  const title = (LANG === "cs" ? r.name_cs : r.name_en);
  const occ = (LANG === "cs" ? r.occupancy_cs : r.occupancy_en) || "";
  const bullets = (LANG === "cs" ? r.feature_bullets_cs : r.feature_bullets_en) || [];

  const tag = (r.status === "available")
    ? t("Available now", "Volné nyní")
    : t(`From ${formatDate(r.available_from)}`, `Od ${formatDate(r.available_from)}`);

  const statusCls = (r.status === "available") ? "available" : "upcoming";

  return `
  <div class="featureCard" data-room="${r.id}">
    <div class="featureImg" style="background-image:url('${img}')">
      <div class="featureTag">${tag}</div>
    </div>
    <div class="featureBody">
      <div class="featureHead">
        <div>
          <strong>${title}</strong>
          <div class="featureMeta">${r.size_m2} m² • ${occ} • ${t("All-inclusive","All-inclusive")}</div>
        </div>
        <div class="price">${t("from","od")} ${formatPriceCZK(r.price_from_czk)}</div>
      </div>

      <div class="statusPill ${statusCls}">${statusLabelShort(r)}</div>

      <div class="featureBullets">
        ${(bullets.length ? bullets : [
          t("Fully renovated interior","Kompletní rekonstrukce"),
          t("High-speed internet included","Rychlý internet v ceně"),
          t("Tram nearby + 3 min to Albert/Lidl","Tramvaj za rohem + 3 min Albert/Lidl")
        ]).slice(0,3).map(x => `
          <div class="bullet"><div class="bdot"></div><div>${x}</div></div>
        `).join("")}
      </div>

      <div class="featureActions">
        <button class="btn primary" data-action="open">${t("View photos & video","Fotky & video")}</button>
        <a class="btn" href="${applyUrlForRoom(r.id)}">${t("Apply","Poptat")}</a>
      </div>
    </div>
  </div>
  `;
}

/* ---------- Render sections ---------- */
function bindRoomEvents(){
  document.querySelectorAll("[data-action='open']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest("[data-room]").dataset.room;
      const r = DATA.rooms.find(x => x.id === id);
      await openRoomModal(r);
    });
  });

  document.querySelectorAll(".cardImg, .featureImg").forEach(el => {
    el.addEventListener("click", async (e) => {
      const id = e.target.closest("[data-room]").dataset.room;
      const r = DATA.rooms.find(x => x.id === id);
      await openRoomModal(r);
    });
  });
}

function renderRooms(){
  const grid = $("#roomsGrid");
  const rooms = DATA.rooms.filter(shouldShowRoom);
  grid.innerHTML = rooms.map(roomCard).join("");
  bindRoomEvents();
  $("#roomsCount").textContent = t(`${rooms.length} shown`, `${rooms.length} zobrazeno`);
}

function renderFeatured(){
  const featured = DATA.rooms
    .filter(r => r.featured === true)
    .sort((a,b) => (a.featured_order||999) - (b.featured_order||999));

  $("#featuredGrid").innerHTML = featured.map(featuredCard).join("");
  bindRoomEvents();
}

function setApplyButtons(){
  const applyTop = $("#applyBtnTop");
  const applyBottom = $("#applyBtnBottom");
  const applyUrl = DATA.contact.apply_url || "";
  const email = DATA.contact.email || "";
  const phone = DATA.contact.phone || "";

  const label = t("Apply / Waitlist", "Poptat / Waitlist");

  let href = "#apply";
  if(applyUrl && !applyUrl.includes("YOUR_FORM_URL_HERE")) {
    href = applyUrl;
  } else if(email && !email.includes("YOUR_EMAIL_HERE")) {
    href = `mailto:${email}?subject=${encodeURIComponent("Brno Focus Living – inquiry")}`;
  }

  [applyTop, applyBottom].forEach(btn => {
    btn.href = href;
    btn.textContent = label;
  });

  $("#availCta").href = href;
  $("#availCta").textContent = label;

  const allInc = DATA.pricing?.[LANG === "cs" ? "all_inclusive_note_cs" : "all_inclusive_note_en"] || "";
  $("#applyNote").textContent = allInc;

  $("#contactLine").textContent = t(
    `Contact: ${email && !email.includes("YOUR_EMAIL_HERE") ? email : "add email"} • ${phone && !phone.includes("YOUR_PHONE_HERE") ? phone : "add phone"}`,
    `Kontakt: ${email && !email.includes("YOUR_EMAIL_HERE") ? email : "doplň e-mail"} • ${phone && !phone.includes("YOUR_PHONE_HERE") ? phone : "doplň telefon"}`
  );

  const slaText = DATA.contact?.[LANG === "cs" ? "response_sla_cs" : "response_sla_en"] || "";
  $("#slaLine").textContent = slaText;
}

function renderHeroAndCopy(){
  const b = DATA.brand;
  $("#brandName").textContent = b.name;
  $("#brandLoc").textContent = b.location;

  $("#heroKicker").textContent = t(
    "Premium shared living • Královo Pole",
    "Prémiové spolubydlení • Královo Pole"
  );

  $("#heroSubtitle").textContent = t(
    "Quiet, renovated shared living for young professionals. All-inclusive pricing, high-speed internet, focus-first rules.",
    "Klidné, zrekonstruované sdílené bydlení pro mladé profesionály. All-inclusive cena, rychlý internet, pravidla pro klid."
  );

  $("#ctaPrimary").textContent = t("See available rooms", "Zobrazit dostupnost");
  $("#ctaSecondary").textContent = t("Apply / Waitlist", "Poptat / Waitlist");

  $("#aboutText").textContent = t(
    "A consistent premium standard — clean, calm and reliable. Ideal if you work in IT/engineering, do research, or want a home that supports a high-quality routine.",
    "Konzistentní prémiový standard — čisté, klidné a spolehlivé. Ideální pro IT/technické profese, výzkum, nebo pokud chceš domov, který podporuje kvalitní režim."
  );

  const highlights = DATA.highlights?.[LANG === "cs" ? "cs" : "en"] || [];
  const trust = DATA.trust_location?.[LANG === "cs" ? "cs" : "en"] || [];
  const combined = [...trust.slice(0,4), ...highlights.slice(0,3)];

  $("#whatIncluded").innerHTML = combined.map(x => `
    <div class="wideItem"><div class="dot"></div><span>${x}</span></div>
  `).join("");

  const rules = DATA.house_rules || {};
  $("#policyLine").textContent = t(
    rules.note_en || "Focus-first house rules: smoke-free, no pets, calm environment.",
    rules.note_cs || "Pravidla pro klid: nekuřácké, bez zvířat, klidné prostředí."
  );

  // availability headline in hero
  const avNow = DATA.rooms.find(r => r.id === "medium"); // we show actual values below anyway
  const nowCount = DATA.availability.available_now_count;
  $("#statBig").textContent = t(
    `${nowCount} available now`,
    `${nowCount} volné nyní`
  );
  $("#statSmall").textContent = t(
    " + 1 large room from 1 Apr 2026",
    "+ 1 velký pokoj od 1. 4. 2026"
  );

  // mini trust bullets in hero
  const mini = trust.slice(0,4);
  $("#trustMini").innerHTML = mini.map(x => `
    <div class="trustItem"><div class="trustDot"></div><div>${x}</div></div>
  `).join("");

  $("#availTitle").textContent = t("Available & upcoming", "Volné a brzy volné");
  $("#availSub").textContent = t(
    "1 room available now + 1 large room from 1 Apr 2026. Tap for photos/video.",
    "1 pokoj volný nyní + 1 velký pokoj volný od 1. 4. 2026. Klikni pro fotky/video."
  );

  $("#hRooms").textContent = t("Room types", "Typy pokojů");
  $("#roomsIntro").textContent = t(
    "Catalog of all room types. The featured cards above are the fastest path.",
    "Katalog všech typů. Nejrychlejší cesta jsou featured karty nahoře."
  );

  $("#hCompanies").textContent = t("For companies / relocation", "Pro firmy / relokace");
  $("#companiesText").textContent = t(
    "Relocating employees to Brno? This is a consistent all-inclusive option suitable for internal boards and onboarding lists.",
    "Relokujete zaměstnance do Brna? Konzistentní all-inclusive varianta vhodná na interní nástěnku a onboarding."
  );

  $("#hr1").textContent = t("All-inclusive pricing (clear budgeting)", "All-inclusive cena (jasný budget)");
  $("#hr2").textContent = t("Move-in ready rooms (fast start)", "Pokoje připravené k nastěhování (rychlý start)");
  $("#hr3").textContent = t("Legal contract + permanent residence registration possible", "Legální smlouva + možnost trvalého pobytu");
  $("#hr4").textContent = t("Tram nearby + 3 min to Albert/Lidl", "Tramvaj za rohem + 3 min Albert/Lidl");

  $("#companiesSnippet").textContent = t(
    "“Brno Focus Living — premium shared living in Brno–Královo Pole. Fully renovated, all-inclusive, high-speed internet. Legal contract, permanent residence registration possible. Tram stop around the corner, 3 minutes to Albert and Lidl. Availability & room types:”",
    "„Brno Focus Living — prémiové sdílené bydlení v Brně–Králově Poli. Kompletní rekonstrukce, all-inclusive, rychlý internet. Legální smlouva, možnost trvalého pobytu pro úřady. Tramvaj za rohem, 3 minuty k Albertu i Lidlu. Dostupnost a typy pokojů:“"
  );

  $("#hApply").textContent = t("Apply / Waitlist", "Poptávka / Waitlist");
  $("#applyText").textContent = t(
    "Tell us your move-in date and routine. We reply with matching options and next steps.",
    "Napiš datum nastěhování a režim. Odpovíme s vhodnými možnostmi a dalšími kroky."
  );
  $("#applyFast").textContent = t("Fast route", "Rychlá cesta");
  $("#applyFastText").textContent = t(
    "Use the application form (recommended) or contact us directly.",
    "Použij formulář (doporučeno) nebo nás kontaktuj napřímo."
  );
  $("#applyTip").textContent = t(
    "Tip: include move-in date, expected stay length, and work/study routine.",
    "Tip: uveď datum nastěhování, délku pobytu a denní režim (práce/studium)."
  );

  setApplyButtons();

  // lang UI
  $("#langEn").classList.toggle("active", LANG === "en");
  $("#langCs").classList.toggle("active", LANG === "cs");

  // filter UI
  updateFilterUI();
}

function updateFilterUI(){
  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === FILTER);
  });
  const toggle = $("#toggleOccupied");
  toggle.classList.toggle("active", SHOW_OCCUPIED);
  toggle.textContent = SHOW_OCCUPIED ? t("Hide occupied", "Skrýt obsazené") : t("Show occupied", "Zobrazit obsazené");
}

/* ---------- Modal + Gallery ---------- */
function youtubeToEmbed(url){
  try{
    const u = new URL(url);
    if(u.hostname.includes("youtu.be")){
      const id = u.pathname.replace("/","");
      return `https://www.youtube.com/embed/${id}`;
    }
    if(u.hostname.includes("youtube.com")){
      const id = u.searchParams.get("v");
      if(id) return `https://www.youtube.com/embed/${id}`;
      if(u.pathname.startsWith("/embed/")) return url;
    }
  } catch(e){}
  return url;
}
function normalizeVideoUrl(url){
  if(!url) return null;
  if(url.includes("youtube.com") || url.includes("youtu.be")) return youtubeToEmbed(url);
  return url;
}

function setGallery(room, idx){
  const imgs = (room.__gallery && room.__gallery.length) ? room.__gallery : [roomCoverUrl(room)];
  GALLERY_INDEX = Math.max(0, Math.min(idx, imgs.length - 1));

  $("#galleryMain").style.backgroundImage = `url('${imgs[GALLERY_INDEX]}')`;

  $("#galleryDots").innerHTML = imgs.map((_, i) =>
    `<button class="dotBtn ${i===GALLERY_INDEX?'active':''}" data-dot="${i}" aria-label="image ${i+1}"></button>`
  ).join("");
  $("#galleryDots").querySelectorAll("button").forEach(b=>{
    b.addEventListener("click", ()=>setGallery(room, parseInt(b.dataset.dot,10)));
  });

  $("#thumbs").innerHTML = imgs.map((src, i) =>
    `<div class="thumb ${i===GALLERY_INDEX?'active':''}" data-thumb="${i}" style="background-image:url('${src}')"></div>`
  ).join("");
  $("#thumbs").querySelectorAll(".thumb").forEach(tn=>{
    tn.addEventListener("click", ()=>setGallery(room, parseInt(tn.dataset.thumb,10)));
  });
}

async function openRoomModal(room){
  if(!room) return;
  ACTIVE_ROOM = room;
  GALLERY_INDEX = 0;

  const title = (LANG === "cs" ? room.name_cs : room.name_en);
  const occ = (LANG === "cs" ? room.occupancy_cs : room.occupancy_en) || "";

  $("#modalTitle").textContent = title;
  $("#modalMeta").textContent = `${room.size_m2} m² • ${occ} • ${t("All-inclusive","All-inclusive")}`;

  $("#modalStatusText").textContent = roomStatusLabel(room.status, room.available_from);
  $("#modalPrice").textContent = `${t("from","od")} ${formatPriceCZK(room.price_from_czk)}`;

  $("#modalAvail").textContent =
    room.status === "occupied"
      ? t(`Currently occupied. Join the waitlist.`, `Aktuálně obsazeno. Přidej se na waitlist.`)
      : (room.status === "upcoming"
          ? t(`Planned from ${formatDate(room.available_from)}`, `Předběžně od ${formatDate(room.available_from)}`)
          : t("Move-in: now (or by agreement)", "Nastěhování: ihned (nebo dle domluvy)")
        );

  const included = (LANG === "cs" ? room.included_cs : room.included_en) || [];
  $("#modalIncluded").innerHTML = included.map(x=>`<li>${x}</li>`).join("");

  const ideal = (LANG === "cs" ? room.ideal_for_cs : room.ideal_for_en) || [];
  $("#modalIdeal").innerHTML = ideal.map(x=>`<li>${x}</li>`).join("");

  // build gallery
  if(room.gallery_folder){
    room.__gallery = await buildGalleryFromFolder(room.gallery_folder);
  } else {
    room.__gallery = [roomCoverUrl(room)];
  }
  setGallery(room, 0);

  // video
  const v = room.video && room.video.url ? room.video : null;
  if(v){
    $("#videoBox").style.display = "block";
    $("#videoTitle").textContent = t(v.title_en || "Video", v.title_cs || "Video");
    $("#videoFrame").src = normalizeVideoUrl(v.url);
  } else {
    $("#videoBox").style.display = "none";
    $("#videoFrame").src = "";
  }

  // CTA
  $("#modalApply").href = applyUrlForRoom(room.id);
  $("#modalApply").textContent = (room.status === "available")
    ? t("Apply / Request a viewing", "Poptat / domluvit prohlídku")
    : t("Apply / Waitlist", "Poptat / Waitlist");

  const modal = $("#roomModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", `#room=${encodeURIComponent(room.id)}`);
}

function closeRoomModal(){
  const modal = $("#roomModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  $("#videoFrame").src = "";
  document.body.style.overflow = "";
  if(location.hash.startsWith("#room=")){
    history.replaceState(null, "", "#availability");
  }
}

function wireModalStaticButtons(){
  if(window.__modalWired) return;
  window.__modalWired = true;

  $("#modalClose").addEventListener("click", closeRoomModal);
  $("#modalOverlay").addEventListener("click", closeRoomModal);

  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape"){
      const modal = $("#roomModal");
      if(modal.classList.contains("open")) closeRoomModal();
    }
  });

  $("#prevImg").addEventListener("click", ()=>{
    if(!ACTIVE_ROOM) return;
    const imgs = (ACTIVE_ROOM.__gallery && ACTIVE_ROOM.__gallery.length) ? ACTIVE_ROOM.__gallery : [roomCoverUrl(ACTIVE_ROOM)];
    setGallery(ACTIVE_ROOM, (GALLERY_INDEX - 1 + imgs.length) % imgs.length);
  });

  $("#nextImg").addEventListener("click", ()=>{
    if(!ACTIVE_ROOM) return;
    const imgs = (ACTIVE_ROOM.__gallery && ACTIVE_ROOM.__gallery.length) ? ACTIVE_ROOM.__gallery : [roomCoverUrl(ACTIVE_ROOM)];
    setGallery(ACTIVE_ROOM, (GALLERY_INDEX + 1) % imgs.length);
  });

  $("#copyLink").addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(window.location.href);
      $("#copyLink").textContent = t("Copied!", "Zkopírováno!");
      setTimeout(()=>$("#copyLink").textContent = t("Copy link", "Kopírovat odkaz"), 1200);
    } catch(e){
      alert(t("Copy failed. Copy the URL from the address bar.", "Nepodařilo se. Zkopíruj adresu z lišty prohlížeče."));
    }
  });
}

/* ---------- Company buttons ---------- */
function wireCompanyButtons(){
  if(window.__companyWired) return;
  window.__companyWired = true;

  $("#copyCompanySnippet").addEventListener("click", async ()=>{
    try{
      const base = window.location.href.split("#")[0];
      const text = $("#companiesSnippet").textContent + " " + base;
      await navigator.clipboard.writeText(text);
      $("#copyCompanySnippet").textContent = t("Copied!", "Zkopírováno!");
      setTimeout(()=>$("#copyCompanySnippet").textContent = t("Copy snippet", "Kopírovat text"), 1200);
    } catch(e){
      alert(t("Copy failed.", "Nepodařilo se zkopírovat."));
    }
  });

  $("#copySiteLink").addEventListener("click", async ()=>{
    try{
      const base = window.location.href.split("#")[0];
      await navigator.clipboard.writeText(base);
      $("#copySiteLink").textContent = t("Copied!", "Zkopírováno!");
      setTimeout(()=>$("#copySiteLink").textContent = t("Copy link", "Kopírovat odkaz"), 1200);
    } catch(e){
      alert(t("Copy failed.", "Nepodařilo se zkopírovat."));
    }
  });
}

/* ---------- Main render ---------- */
function renderAll(){
  renderHeroAndCopy();
  renderFeatured();
  renderRooms();
  wireModalStaticButtons();
  wireCompanyButtons();
}

/* ---------- Init ---------- */
async function init(){
  const res = await fetch("rooms.json", { cache: "no-store" });
  DATA = await res.json();

  // language
  $("#langEn").addEventListener("click", ()=>{ LANG="en"; localStorage.setItem("bfl_lang", LANG); renderAll(); });
  $("#langCs").addEventListener("click", ()=>{ LANG="cs"; localStorage.setItem("bfl_lang", LANG); renderAll(); });

  // filters
  $("#filterAll").addEventListener("click", ()=>{ FILTER="all"; renderRooms(); updateFilterUI(); });
  $("#filterAvailable").addEventListener("click", ()=>{ FILTER="available"; renderRooms(); updateFilterUI(); });
  $("#filterUpcoming").addEventListener("click", ()=>{ FILTER="upcoming"; renderRooms(); updateFilterUI(); });
  $("#filterOccupied").addEventListener("click", ()=>{ FILTER="occupied"; renderRooms(); updateFilterUI(); });

  $("#toggleOccupied").addEventListener("click", ()=>{
    SHOW_OCCUPIED = !SHOW_OCCUPIED;
    renderRooms();
    updateFilterUI();
  });

  renderAll();

  // deep link support: #room=medium
  if(location.hash.startsWith("#room=")){
    const id = decodeURIComponent(location.hash.replace("#room=",""));
    const r = DATA.rooms.find(x=>x.id===id);
    if(r) await openRoomModal(r);
  }
}

init();
