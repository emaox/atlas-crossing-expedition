/* ============================================================
   GLITCH SWAP — titolo e citazioni in alternanza IT ⇄ AR
   ogni 5s tutti gli elementi .glitch-swap passano insieme
   dal testo originale alla traduzione araba e viceversa
   ============================================================ */
const glitchSwapEls = document.querySelectorAll(".glitch-swap");

if (glitchSwapEls.length) {
  let showingArabic = false;

  setInterval(() => {
    showingArabic = !showingArabic;

    glitchSwapEls.forEach(el => {
      const nextText = showingArabic
        ? el.getAttribute("data-text-ar")
        : el.getAttribute("data-text-it");

      // fase 1: dissolve rapido del testo corrente
      el.classList.add("glitch-fade");

      setTimeout(() => {
        // fase 2: swap testo + direzione + scatto glitch
        el.textContent = nextText;
        el.setAttribute("data-text", nextText);
        el.classList.toggle("is-arabic", showingArabic);
        el.classList.remove("glitch-fade");
        el.classList.add("glitching");

        setTimeout(() => {
          el.classList.remove("glitching");
        }, 400);
      }, 150);
    });
  }, 5000);
}


/* ============================================================
   DATI — tappe, tooltip layout, nomi brevi
   ============================================================ */

const tappe = [
  { step: 1, nome: "Marrakech",       coords: [31.6225, -7.9898], terreno: "URBANO / PIANURA" },
  { step: 2, nome: "Telouet",         coords: [31.2888, -7.2396], terreno: "MONTAGNA — ALTO ATLANTE" },
  { step: 3, nome: "Aït Benhaddou",   coords: [31.0470, -7.1319], terreno: "KASBAH — PRE-DESERTICO" },
  { step: 4, nome: "Gole del Dades",  coords: [31.4532, -5.9675], terreno: "CANYON ROCCIOSO" },
  { step: 5, nome: "Gole del Todra",  coords: [31.5220, -5.5274], terreno: "CANYON ROCCIOSO" },
  { step: 6, nome: "Erfoud",          coords: [31.4347, -4.2337], terreno: "HAMADA — PIETROSO" },
  { step: 7, nome: "Merzouga",        coords: [31.0802, -4.0134], terreno: "ERG — DUNE SABBIOSE" }
];

const previewNames = {
  1: "Marrakech",
  2: "Telouet",
  3: "Benhaddou",
  4: "Dades",
  5: "Todra",
  6: "Erfoud",
  7: "Merzouga"
};

const tooltipLayout = {
  1: { direction: "bottom", offset: [0,  18] },
  2: { direction: "top",    offset: [0, -22] },
  3: { direction: "right",  offset: [24, -2] },
  4: { direction: "left",   offset: [-24, 2] },
  5: { direction: "top",    offset: [0, -22] },
  6: { direction: "bottom", offset: [0,  18] },
  7: { direction: "top",    offset: [0, -22] }
};

const tooltipOptions = {
  permanent: true,
  className: "custom-tooltip"
};


/* ============================================================
   COUNTDOWN
   ============================================================ */
function startCountdown() {
  const targetDate   = new Date("2027-04-17T00:00:00");
  const daysEl       = document.getElementById("countdownDays");
  const hoursEl      = document.getElementById("countdownHours");
  const minutesEl    = document.getElementById("countdownMinutes");
  const secondsEl    = document.getElementById("countdownSeconds");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  function updateTimer() {
    const diff = targetDate - new Date();

    if (diff <= 0) {
      [daysEl, hoursEl, minutesEl, secondsEl].forEach(el => el.textContent = "00");
      clearInterval(intervalId);
      return;
    }

    daysEl.textContent    = String(Math.floor(diff / 86400000)).padStart(2, "0");
    hoursEl.textContent   = String(Math.floor((diff / 3600000)  % 24)).padStart(2, "0");
    minutesEl.textContent = String(Math.floor((diff / 60000)    % 60)).padStart(2, "0");
    secondsEl.textContent = String(Math.floor((diff / 1000)     % 60)).padStart(2, "0");
  }

  updateTimer();
  const intervalId = setInterval(updateTimer, 1000);
}


/* ============================================================
   MAPPA
   ============================================================ */
const map = L.map("boundedMap", {
  zoomControl:       false,
  scrollWheelZoom:   false,
  dragging:          false   // FIX: evita scroll accidentale su mobile
});

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
).addTo(map);

const coordinateIntere = tappe.map(t => t.coords);
let   boundsTotale     = L.latLngBounds(coordinateIntere);
const tracciaAttiva    = L.polyline([], {
  color: "#e67e22",
  weight: 5,
  opacity: 1,
  lineJoin: "round"
}).addTo(map);


/* ============================================================
   ROUTE OSRM
   ============================================================ */
let gpsRoute      = [];
let routeStepIndex = {};
let routeLoaded   = false;
let ultimoStepAttivo = null;  // tracciamo lo step visibile al momento del load

async function caricaPercorsoStradale() {
  const waypoints = tappe.map(t => `${t.coords[1]},${t.coords[0]}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      console.warn("OSRM: risposta non valida", data);
      return;
    }

    gpsRoute = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

    tappe.forEach(t => {
      routeStepIndex[t.step] = trovaIndicePilota(t.coords, gpsRoute);
    });

    routeLoaded  = true;
    boundsTotale = L.latLngBounds(gpsRoute);

    // FIX: se l'utente è già su uno step, ridisegna con la traccia reale
    if (ultimoStepAttivo !== null) {
      const prev = ultimoStepAttivo;
      ultimoStepAttivo = null;       // forza re-render
      gestisciMappa(prev);
    } else {
      map.fitBounds(boundsTotale, { padding: [40, 40] });
    }

  } catch (err) {
    console.warn("OSRM non raggiungibile, uso linea retta", err);
  }
}

function trovaIndicePilota(coords, route) {
  let bestIndex = 0;
  let bestDist  = Infinity;

  route.forEach((point, i) => {
    const dx   = point[0] - coords[0];
    const dy   = point[1] - coords[1];
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) { bestDist = dist; bestIndex = i; }
  });

  return bestIndex;
}


/* ============================================================
   MARKER & TOOLTIP
   ============================================================ */
const listaMarker = {};

tappe.forEach(t => {
  const layout = tooltipLayout[t.step] ?? { direction: "top", offset: [0, -10] };

  listaMarker[t.step] = L.circleMarker(t.coords, {
    radius:      5,
    fillColor:   "#ffffff",
    color:       "#e67e22",
    weight:      1.5,
    fillOpacity: 0.95,
    interactive: false,
    className:   "hud-marker"
  })
  .addTo(map)
  .bindTooltip(previewNames[t.step] ?? t.nome, { ...tooltipOptions, ...layout });
});


/* ============================================================
   LOGICA TOOLTIP PER STEP
   ============================================================ */
function aggiornaTooltipAttivo(step) {
  Object.entries(listaMarker).forEach(([key, marker]) => {
    const n = parseInt(key, 10);

    // step 0 o 8 → tutti i tooltip visibili
    if (step === 0 || step === 8) {
      marker.openTooltip();
    } else {
      // solo il marker dello step corrente
      n === step ? marker.openTooltip() : marker.closeTooltip();
    }
  });
}


/* ============================================================
   HUD READOUT — territorio + coordinate (stile ricognizione)
   ============================================================ */
const hudTerreno = document.getElementById("hudTerreno");
const hudCoords  = document.getElementById("hudCoords");
const hudStep    = document.getElementById("hudStep");

function aggiornaHud(step) {
  if (!hudTerreno || !hudCoords || !hudStep) return;

  if (step === 0) {
    hudTerreno.textContent = "PANORAMICA TRACCIATO";
    hudCoords.textContent  = "MARRAKECH → MERZOUGA";
    hudStep.textContent    = "OVERVIEW";
  } else if (step === 8) {
    hudTerreno.textContent = "TRACCIATO COMPLETO";
    hudCoords.textContent  = "598 KM • 7 TAPPE";
    hudStep.textContent    = "FINAL";
  } else {
    const t = tappe[step - 1];
    hudTerreno.textContent = t.terreno;
    hudCoords.textContent  = `${t.coords[0].toFixed(4)}° N  ${Math.abs(t.coords[1]).toFixed(4)}° W`;
    hudStep.textContent    = `TAPPA ${String(step).padStart(2, "0")}/07`;
  }
}


/* ============================================================
   GESTIONE MAPPA PER STEP
   ============================================================ */
let flyTimeout;

function gestisciMappa(step) {
  if (ultimoStepAttivo === step) return;
  ultimoStepAttivo = step;
  clearTimeout(flyTimeout);
  aggiornaHud(step);

  if (step === 0) {
    tracciaAttiva.setLatLngs([]);
    aggiornaTooltipAttivo(0);
    const b = boundsTotale.pad(0.35);
    map.flyToBounds(b, { padding: [40, 40], duration: 1.2 });

  } else if (step === 8) {
    tracciaAttiva.setLatLngs(routeLoaded ? gpsRoute : coordinateIntere);
    // step 8: solo tracciato, nessun tooltip
    Object.values(listaMarker).forEach(m => m.closeTooltip());
    const b = boundsTotale.pad(0.35);
    map.flyToBounds(b, { padding: [40, 40], duration: 1.2 });

  } else {
    const endIdx = routeStepIndex[step] !== undefined
      ? routeStepIndex[step]
      : (routeLoaded ? gpsRoute.length - 1 : step - 1);

    const path = routeLoaded
      ? gpsRoute.slice(0, endIdx + 1)
      : coordinateIntere.slice(0, step);

    tracciaAttiva.setLatLngs(path);
    aggiornaTooltipAttivo(step);

    flyTimeout = setTimeout(() => {
      map.flyTo(tappe[step - 1].coords, 8, {
        animate: true,
        duration: 1.2,
        easeLinearity: 0.2
      });
    }, 50);
  }
}


/* ============================================================
   INTERSECTION OBSERVER — QUOTE
   ============================================================ */
const quoteSlides   = document.querySelectorAll(".quote-slide");
const quoteObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      quoteSlides.forEach(q => q.classList.remove("active"));
      entry.target.classList.add("active");
    }
  });
}, { threshold: 0.6 });

quoteSlides.forEach(q => quoteObserver.observe(q));


/* ============================================================
   INTERSECTION OBSERVER — DAY CARDS
   ============================================================ */
const cards    = document.querySelectorAll(".day-card");
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      cards.forEach(c => c.classList.remove("active"));
      entry.target.classList.add("active");
      gestisciMappa(parseInt(entry.target.dataset.step));
    }
  });
}, { threshold: 0.5 });

cards.forEach(c => observer.observe(c));


/* ============================================================
   KEYBOARD NAVIGATION
   ============================================================ */
const quotesSection = document.querySelector(".quotes-section");
const sections = [
  document.querySelector(".intro-section"),
  quotesSection,
  document.querySelector(".spirit-section"),
  ...Array.from(cards)
].filter(Boolean);

function getCurrentSectionIndex() {
  const center = window.innerHeight / 2;
  let closest = 0, minDist = Infinity;

  sections.forEach((s, i) => {
    const rect = s.getBoundingClientRect();
    const dist = Math.abs(rect.top + rect.height / 2 - center);
    if (dist < minDist) { minDist = dist; closest = i; }
  });

  return closest;
}

function scrollSection(dir) {
  const next = Math.max(0, Math.min(sections.length - 1, getCurrentSectionIndex() + dir));
  sections[next].scrollIntoView({ behavior: "smooth", block: "start" });
}

window.addEventListener("keydown", e => {
  const inQuotes = quotesSection &&
    (quotesSection.contains(e.target) || quotesSection.contains(document.activeElement));

  if (inQuotes && ["ArrowDown","ArrowUp","PageDown","PageUp"].includes(e.key)) return;

  if (["ArrowDown","PageDown","ArrowRight"].includes(e.key)) { e.preventDefault(); scrollSection(1);  }
  if (["ArrowUp","PageUp","ArrowLeft"].includes(e.key))      { e.preventDefault(); scrollSection(-1); }
});


/* ============================================================
   RESET ALLO SCROLL IN CIMA
   ============================================================ */
window.addEventListener("scroll", () => {
  if (window.scrollY < 50 && ultimoStepAttivo !== null) {
    clearTimeout(flyTimeout);
    ultimoStepAttivo = null;
    tracciaAttiva.setLatLngs([]);
    aggiornaTooltipAttivo(0);  // FIX: era null, ora passa 0 → apre tutti i tooltip
    map.flyTo(boundsTotale.getCenter(), 7, { animate: true, duration: 1.0 });
    setTimeout(() => map.fitBounds(boundsTotale, { padding: [40, 40] }), 500);
  }
});

/* ============================================================
   TEAM — carosello con frecce, video play/pause sull'ultimo frame
   ============================================================ */
(function () {
  const teamScroll = document.getElementById("teamScroll");
  const btnPrev    = document.getElementById("teamPrev");
  const btnNext    = document.getElementById("teamNext");
  if (!teamScroll) return;

  const teamCards = Array.from(teamScroll.querySelectorAll(".team-card"));
  let current = 0;

  /* --- padding laterale dinamico per centrare prima e ultima card --- */
  function aggiornaPadding() {
    const cardW    = teamCards[0]?.offsetWidth || 840;
    const side     = Math.max(0, (teamScroll.offsetWidth - cardW) / 2);
    teamScroll.style.paddingLeft  = side + "px";
    teamScroll.style.paddingRight = side + "px";
  }

  aggiornaPadding();
  window.addEventListener("resize", aggiornaPadding);

  function aggiornaFrecce() {
    if (btnPrev) btnPrev.disabled = current === 0;
    if (btnNext) btnNext.disabled = current === teamCards.length - 1;
  }

  function attivaCard(index) {
    current = index;
    teamCards.forEach((c, i) => {
      const v = c.querySelector(".team-video");
      if (i === index) {
        c.classList.add("active");
        if (v) { v.currentTime = 0; v.play().catch(() => {}); }
      } else {
        c.classList.remove("active");
        if (v && !v.paused) v.pause();
      }
    });
    const card       = teamCards[index];
    const scrollLeft = card.offsetLeft - (teamScroll.offsetWidth - card.offsetWidth) / 2;
    teamScroll.scrollTo({ left: scrollLeft, behavior: "smooth" });
    aggiornaFrecce();
  }

  teamCards.forEach(card => {
    const v = card.querySelector(".team-video");
    if (!v) return;
    v.addEventListener("ended", () => {
      v.currentTime = Math.max(0, v.duration - 0.04);
      v.pause();
    });
    v.addEventListener("mouseenter", () => {
      v.currentTime = 0;
      v.play().catch(() => {});
    });
  });

  if (btnPrev) btnPrev.addEventListener("click", () => { if (current > 0) attivaCard(current - 1); });
  if (btnNext) btnNext.addEventListener("click", () => { if (current < teamCards.length - 1) attivaCard(current + 1); });

  if (teamCards.length) attivaCard(0);
})();

/* ============================================================
   FORM CANDIDATURA → Google Apps Script
   ============================================================ */
(function () {

  // ⚠️ INCOLLA QUI IL NUOVO URL LUNGO CHE TI HA DATO GOOGLE (Che finisce per /exec)
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxoZEkMCRIcwM9EY2Zx7eTwalG-gOCZCBEyzVlkiebJiY9jJiBDU_GsWg0OZ1rEXVv1/exec";

  const btn      = document.getElementById("btnCandidatura");
  const feedback = document.getElementById("formFeedback");
  if (!btn || !feedback) return;

  const form = document.getElementById("formCandidatura");
  if (form) form.addEventListener("submit", e => e.preventDefault());

  btn.addEventListener("click", () => {
    const nome        = document.getElementById("fieldNome")?.value.trim();
    const cognome     = document.getElementById("fieldCognome")?.value.trim();
    const eta         = document.getElementById("fieldEta")?.value.trim();
    const telefono    = document.getElementById("fieldTelefono")?.value.trim();
    const email       = document.getElementById("fieldEmail")?.value.trim();
    const esperienza  = document.getElementById("fieldEsperienza")?.value;
    const motivazione = document.getElementById("fieldMotivazione")?.value.trim();

    if (!nome || !cognome || !eta || !telefono || !email || !esperienza || !motivazione) {
      feedback.textContent = "Compila tutti i campi prima di inviare.";
      feedback.className   = "form-feedback error";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      feedback.textContent = "Inserisci un indirizzo email valido.";
      feedback.className   = "form-feedback error";
      return;
    }

    btn.disabled         = true;
    btn.textContent      = "Invio in corso…";
    feedback.textContent = "";
    feedback.className   = "form-feedback";

    const params = new URLSearchParams({ nome, cognome, eta, telefono, email, experiencia: esperienza, motivazione });
    // Coerente con lo script che ora usa doGet
    const url    = SCRIPT_URL + "?" + params.toString();

    // Usiamo un Image() — segue i redirect di Google senza blocchi CORS e dialoga perfettamente con doGet
    const img    = new Image();
    
    function mostraSuccesso() {
      btn.textContent      = "Candidatura inviata ✓";
      feedback.textContent = "Grazie " + nome + "! Controlla la tua email — ti abbiamo inviato il programma completo.";
      feedback.className   = "form-feedback success"; 
      if (form) form.reset();
    }

    const timer  = setTimeout(() => {
      mostraSuccesso();
    }, 6000);

    img.onload = img.onerror = () => {
      clearTimeout(timer);
      mostraSuccesso();
    };

    img.src = url;
  });
})();

/* ============================================================
   COUNTDOWN EARLY BIRD
   ============================================================ */
(function () {
  const target  = new Date("2026-12-31T23:59:59");
  const daysEl  = document.getElementById("ebDays");
  const hoursEl = document.getElementById("ebHours");
  const minsEl  = document.getElementById("ebMinutes");
  const secsEl  = document.getElementById("ebSeconds");
  if (!daysEl) return;

  function update() {
    const diff = target - new Date();
    if (diff <= 0) {
      [daysEl, hoursEl, minsEl, secsEl].forEach(el => el.textContent = "00");
      clearInterval(id);
      return;
    }
    daysEl.textContent  = String(Math.floor(diff / 86400000)).padStart(2, "0");
    hoursEl.textContent = String(Math.floor((diff / 3600000) % 24)).padStart(2, "0");
    minsEl.textContent  = String(Math.floor((diff / 60000)   % 60)).padStart(2, "0");
    secsEl.textContent  = String(Math.floor((diff / 1000)    % 60)).padStart(2, "0");
  }

  update();
  const id = setInterval(update, 1000);
})();


/* ============================================================
   ACCORDION QUOTA
   ============================================================ */
document.querySelectorAll(".accordion-trigger").forEach(trigger => {
  trigger.addEventListener("click", () => {
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    const panel    = document.getElementById(trigger.getAttribute("aria-controls"));

    // chiudi tutti gli altri
    document.querySelectorAll(".accordion-trigger").forEach(t => {
      t.setAttribute("aria-expanded", "false");
      const p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = true;
    });

    // apri/chiudi quello cliccato
    if (!expanded) {
      trigger.setAttribute("aria-expanded", "true");
      if (panel) panel.hidden = false;
    }
  });
});

map.fitBounds(boundsTotale, { padding: [40, 40] });
aggiornaTooltipAttivo(0);
startCountdown();
caricaPercorsoStradale();