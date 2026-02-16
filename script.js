const $ = (sel) => document.querySelector(sel);

let DATA = null;
let LANG = localStorage.getItem("bfl_lang") || "en";
let FILTER = "all"; // all | available | upcoming | occupied
let SHOW_OCCUPIED = false;

function t(en, cs){
  return LANG === "cs" ? cs : en;
}

function formatPriceCZK(n){
  const s = new Intl.NumberFormat("cs-CZ").format(n);
  return `${s} Kč`;
}

function formatDate(d){
  if(!d || d === "now") return t("Now", "Ihned");
  // Expect YYYY-MM-DD
  const [y,m,day] = d.split("-").map(x=>parseInt(x,10));
  const dt = new Date(y, m-1, day);
  return new Intl.DateTimeFormat(LANG === "cs" ? "cs-CZ" : "en-GB", { year:"numeric", month:"short", day:"2-digit" }).format(dt);
}

function setLang(next){
  LANG = next;
  localStorage.setItem("bfl_lang", LANG);
  renderAll();
}

function setFilter(next){
  FILTER = next;
  renderRooms();
  updateFilterUI();
}

function updateFilterUI(){
  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === FILTER);
  });
  const toggle = $("#toggleOccupied");
  if(toggle){
    toggle.classList.toggle("active", SHOW_OCCUPIED);
    toggle.textContent = SHOW_OCCUPIED ? t("Hide occupied", "Skrýt obsazené") : t("Show occupied", "Zobrazit obsazené");
  }
}

function roomStatusLabel(status, availableFrom){
  if(status === "available") return t("Available", "Volné");
  if(status === "upcoming") return t(`Available from ${formatDate(availableFrom)}`, `Volné od ${formatDate(availableFrom)}`);
  return t("Occupied", "Obsazeno");
}

function shouldShowRoom(r){
  if(r.status === "occupied" && !SHOW_OCCUPIED) return false;
  if(FILTER === "all") return true;
  return r.status === FILTER;
}

function roomCard(r){
  const statusLabel = roomStatusLabel(r.status, r.available_from);
  const price = t("from", "od");
  const included = (LANG === "cs" ? r.included_cs : r.included_en) || [];
  const idealFor = (LANG === "cs" ? r.ideal_for_cs : r.ideal_for_en) || [];

  const statusClass = `status ${r.status}`;
  const img = r.image || "assets/img/placeholder.jpg";

  return `
  <div class="card" data-room="${r.id}">
    <div class="cardImg" style="background-image:url('${img}')"></div>
    <div class="cardBody">
      <div class="cardTitle">
        <div>
          <strong>${LANG === "cs" ? r.name_cs : r.name_en}</strong>
          <div class="meta">${r.size_m2} m² • ${t("Total", "Celkem")}: ${r.units_total}</div>
        </div>
        <div class="price">${price} ${formatPriceCZK(r.price_from_czk)}</div>
      </div>

      <div class="${statusClass}">${statusLabel}</div>
      <div class="meta">${LANG === "cs" ? r.summary_cs : r.summary_en}</div>

      <div class="cardActions">
        <button class="btn primary" data-action="toggle">${t("Details", "Detail")}</button>
        <a class="btn" href="#apply">${t("Apply", "Poptat")}</a>
      </div>
    </div>

    <div class="details" id="details-${r.id}">
      <div class="kv">
        <div class="kvBox">
          <strong>${t("What's included", "Co je v ceně")}</strong>
          <ul>${included.map(x=>`<li>${x}</li>`).join("")}</ul>
        </div>
        <div class="kvBox">
          <strong>${t("Ideal for", "Ideální pro")}</strong>
          <ul>${idealFor.map(x=>`<li>${x}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  </div>
  `;
}

function bindRoomEvents(){
  document.querySelectorAll(".card [data-action='toggle']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      const id = card.dataset.room;
      const details = $(`#details-${id}`);
      details.classList.toggle("open");
    });
  });
}

function renderRooms(){
  const grid = $("#roomsGrid");
  const rooms = DATA.rooms.filter(shouldShowRoom);
  grid.innerHTML = rooms.map(roomCard).join("");
  bindRoomEvents();
  $("#roomsCount").textContent = t(`${rooms.length} room types shown`, `${rooms.length} typy pokojů zobrazeny`);
}

function renderHeroAndCopy(){
  const b = DATA.brand;
  $("#brandName").textContent = b.name;
  $("#brandLoc").textContent = b.location;

  $("#heroTitle").textContent = b.name;
  $("#heroSubtitle").textContent = t(
    "Quiet shared living in Brno – Královo Pole for young professionals and focused students.",
    "Klidné sdílené bydlení v Brně – Králově Poli pro mladé profesionály a studenty, kteří chtějí mít doma klid."
  );

  $("#aboutText").textContent = t(
    "A fully renovated shared living concept designed for clean, calm and reliable everyday life. Ideal if you work in IT/engineering, do research, or simply want a home where you can truly focus.",
    "Kompletně rekonstruované sdílené bydlení postavené na čistotě, klidu a spolehlivosti. Ideální pro IT/technické profese, výzkum, nebo kohokoliv, kdo chce doma opravdu vypnout a soustředit se."
  );

  $("#whatIncluded").innerHTML = `
    <div class="li"><div class="dot"></div><span>${t("All-inclusive pricing (utilities included)", "All-inclusive cena (energie a služby v ceně)")}</span></div>
    <div class="li"><div class="dot"></div><span>${t("High-speed internet included", "Rychlý internet v ceně")}</span></div>
    <div class="li"><div class="dot"></div><span>${t("Custom-made kitchen, fully equipped", "Kuchyň na míru, plně vybavená")}</span></div>
    <div class="li"><div class="dot"></div><span>${t("Shared bathrooms + separate WC", "Sdílené koupelny + separátní WC")}</span></div>
    <div class="li"><div class="dot"></div><span>${t("Calm building, hassle-free neighbors", "Klidný dům, bezproblémoví sousedé")}</span></div>
    <div class="li"><div class="dot"></div><span>${t("Smoke-free • No pets • Not a party flat", "Nekuřácké • Bez zvířat • Ne party byt")}</span></div>
  `;

  // Apply button
  const applyUrl = DATA.contact.apply_url || "";
  const email = DATA.contact.email || "";
  const phone = DATA.contact.phone || "";

  const applyBtn = $("#applyBtn");
  if(applyUrl && applyUrl !== "YOUR_FORM_URL_HERE"){
    applyBtn.href = applyUrl;
    applyBtn.textContent = t("Apply / Request a viewing", "Poptat / domluvit prohlídku");
  } else if(email && email !== "YOUR_EMAIL_HERE"){
    applyBtn.href = `mailto:${email}?subject=${encodeURIComponent("Brno Focus Living – inquiry")}`;
    applyBtn.textContent = t("Email us", "Napsat e-mail");
  } else {
    applyBtn.href = "#";
    applyBtn.textContent = t("Add your contact details", "Doplň kontaktní údaje");
  }

  $("#contactLine").textContent = t(
    `Contact: ${email !== "YOUR_EMAIL_HERE" ? email : "add email"} • ${phone !== "YOUR_PHONE_HERE" ? phone : "add phone"}`,
    `Kontakt: ${email !== "YOUR_EMAIL_HERE" ? email : "doplň e-mail"} • ${phone !== "YOUR_PHONE_HERE" ? phone : "doplň telefon"}`
  );

  $("#policyLine").textContent = t(
    "Focus-first house rules: smoke-free, no pets, calm environment.",
    "Pravidla pro klid: nekuřácké, bez zvířat, klidné prostředí."
  );

  // Language pills
  $("#langEn").classList.toggle("active", LANG === "en");
  $("#langCs").classList.toggle("active", LANG === "cs");

  // Headings
  $("#hRooms").textContent = t("Room types", "Typy pokojů");
  $("#hFiltersLabel").textContent = t("Filter", "Filtr");
  $("#filterAll").textContent = t("All", "Vše");
  $("#filterAvailable").textContent = t("Available", "Volné");
  $("#filterUpcoming").textContent = t("Upcoming", "Brzy volné");
  $("#filterOccupied").textContent = t("Occupied", "Obsazené");
  $("#hApply").textContent = t("Apply", "Poptávka");
  $("#applyText").textContent = t(
    "Tell us who you are and when you want to move in. We’ll reply with matching options and the next steps.",
    "Napiš, kdo jsi a kdy se chceš nastěhovat. Ozveme se s vhodnými možnostmi a dalšími kroky."
  );
}

function renderAll(){
  renderHeroAndCopy();
  renderRooms();
  updateFilterUI();
}

async function init(){
  const res = await fetch("rooms.json", { cache: "no-store" });
  DATA = await res.json();

  // Bind language
  $("#langEn").addEventListener("click", ()=>setLang("en"));
  $("#langCs").addEventListener("click", ()=>setLang("cs"));

  // Bind filters
  $("#filterAll").addEventListener("click", ()=>setFilter("all"));
  $("#filterAvailable").addEventListener("click", ()=>setFilter("available"));
  $("#filterUpcoming").addEventListener("click", ()=>setFilter("upcoming"));
  $("#filterOccupied").addEventListener("click", ()=>setFilter("occupied"));

  $("#toggleOccupied").addEventListener("click", ()=>{
    SHOW_OCCUPIED = !SHOW_OCCUPIED;
    renderRooms();
    updateFilterUI();
  });

  renderAll();
}

init();
