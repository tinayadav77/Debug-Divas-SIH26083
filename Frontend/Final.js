/* =========================================================================
   HEATWATCH — Extreme Heat Early Warning Dashboard
   Vijayawada & Aynavolu | Disaster Management Demo

   -------------------------------------------------------------------------
   BACKEND INTEGRATION (FastAPI)
   -------------------------------------------------------------------------
   This build is wired up to the FastAPI backend at API_BASE_URL below.
   Two real routes back the whole dashboard:

     GET /dashboard/{location}   -> { location, weather, thermal_stress,
                                      risk, recommendations }
     GET /forecast/{location}    -> forecast data for that location

   {location} must match the backend's exact spelling/casing — see
   LOCATION_PARAM below. The backend route is "Ainavolu"; the UI keeps the
   existing "Aynavolu" display spelling, so the two are mapped rather than
   assumed to be the same string. Only /dashboard/{location} and
   /forecast/{location} are real backend routes, and only those two ever
   call LOCATION_PARAM / hit the network — every other getX() below is
   demo-only (see MOCK_PROVIDER) and never touches the "Aynavolu" spelling.

   Everything the MVP backend doesn't expose yet (per-ward detail, the
   alert/emergency-contact/vulnerable-group/safety reference content) is
   served from MOCK_PROVIDER and ALWAYS routed there, regardless of whether
   a live backend is connected — those routes don't exist on the backend,
   so we don't attempt to fetch them (see requestDemo / api below). The
   ward map is a schematic simulation for this demo, labelled "Demo Ward
   Map" in the UI, and is never presented as live data.

   HEAT INDEX / THERMAL STRESS: the frontend does not calculate heat index.
   For the two real routes (dashboard, forecast), the temperature,
   humidity and thermal-stress/heat-index numbers shown are exactly what
   the backend returns — no formula is applied to them here. The demo-only
   ward simulator (MOCK_PROVIDER.wards) needs *some* numbers to fill in a
   ward grid the backend doesn't expose per-ward yet, so it seeds a risk
   band and a thermal-stress figure directly (pickWardRisk /
   simulatedThermalStress) rather than deriving either from a heat-index
   formula — there is no Rothfusz/heat-index calculation anywhere in this
   file anymore. Forecast values are never fabricated in JS either: if the
   backend returns no forecast, the UI says so instead of inventing one.
   ========================================================================= */

(function () {
  "use strict";

  // Default to the FastAPI backend used for tomorrow's hackathon demo.
  // Override by setting window.HEATWATCH_API_BASE_URL before this script
  // loads (see the <script> line near the top of index.html).
  const API_BASE_URL = window.HEATWATCH_API_BASE_URL || "http://127.0.0.1:8000";
  const USING_LIVE_API = !!API_BASE_URL;

  /* ---------------------------------------------------------------------
     Tiny seeded RNG so the simulator is stable across reloads instead of
     jumping around randomly every time the page is opened.
     --------------------------------------------------------------------- */
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822519);
      h = Math.imul(h ^ (h >>> 13), 3266489917);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function rngFor(seedStr) {
    return hashSeed(seedStr);
  }

  function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  /* ---------------------------------------------------------------------
     DEMO-ONLY ward simulator helpers.
     No heat index is calculated in this file. The backend is the sole
     source of truth for real heat-index / thermal-stress numbers (used
     as-is from /dashboard and /forecast — see below). Because the backend
     doesn't expose a per-ward route yet, the schematic "Demo Ward Map"
     needs placeholder numbers to fill its grid; those are seeded directly
     per risk band rather than derived from any temperature/humidity
     formula, so this is a random assignment, not a heat-index estimate.
     --------------------------------------------------------------------- */
  function pickWardRisk(rand) {
    const r = rand();
    if (r < 0.25) return "red";
    if (r < 0.6) return "yellow";
    return "green";
  }

  const DEMO_THERMAL_STRESS_RANGE = {
    red: [41, 48],
    yellow: [33, 40.9],
    green: [24, 32.9],
  };

  function simulatedThermalStress(rand, risk) {
    const [lo, hi] = DEMO_THERMAL_STRESS_RANGE[risk];
    return Math.round((lo + rand() * (hi - lo)) * 10) / 10;
  }

  const RISK_LABEL = {
    red: "High Alert",
    yellow: "Moderate",
    green: "Low Risk",
  };

  /* ---------------------------------------------------------------------
     Backend location keys. The FastAPI backend expects the exact strings
     "Vijayawada" and "Ainavolu" in the URL path. Our internal city id /
     display name ("Aynavolu") is kept as-is so the UI doesn't change —
     this map is what actually gets sent to the backend.
     --------------------------------------------------------------------- */
  const LOCATION_PARAM = {
    vijayawada: "Vijayawada",
    aynavolu: "Ainavolu",
  };

  // Backend risk/thermal levels are a 5-step scale (LOW / MODERATE / HIGH /
  // VERY HIGH / EXTREME). The existing UI only has 3 colors, so this maps
  // the real level onto the existing red/yellow/green system rather than
  // redesigning it.
  function riskColorFromLevel(level) {
    const L = String(level || "").toUpperCase();
    if (L === "LOW") return "green";
    if (L === "MODERATE") return "yellow";
    if (L === "HIGH" || L === "VERY HIGH" || L === "EXTREME") return "red";
    return "green";
  }

  function titleCase(str) {
    if (str === null || str === undefined || str === "") return "";
    return String(str)
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Never surface {}, null, or undefined straight to the UI.
  function safeVal(v, fallback) {
    fallback = fallback === undefined ? "N/A" : fallback;
    if (v === null || v === undefined) return fallback;
    if (typeof v === "object" && Object.keys(v).length === 0) return fallback;
    return v;
  }

  // Early Warning card copy, keyed by backend risk/thermal level.
  // NOTE: your friend's HIGH and VERY HIGH/EXTREME lines were cut off in
  // the screenshot — the wording below is a reasonable reconstruction in
  // the same style as the LOW/MODERATE lines. Worth a quick check against
  // whatever the original message actually said before the demo.
  const EARLY_WARNING_COPY = {
    LOW: {
      action: "Conditions currently safe for outdoor activity.",
      note: "Stay hydrated and continue monitoring conditions.",
    },
    MODERATE: {
      action: "Limit prolonged outdoor exposure.",
      note: "Stay hydrated and take breaks in the shade during peak hours.",
    },
    HIGH: {
      action: "Avoid unnecessary outdoor activity and protect vulnerable groups.",
      note: "Check on elderly neighbours, infants, and outdoor workers regularly.",
    },
    "VERY HIGH": {
      action: "Avoid outdoor exposure and seek shelter immediately.",
      note: "Watch for signs of heat exhaustion and seek medical help if needed.",
    },
    EXTREME: {
      action: "Avoid outdoor exposure and seek shelter immediately.",
      note: "Treat this as an emergency risk — check on vulnerable individuals now.",
    },
  };

  /* =======================================================================
     REFERENCE CONTENT
     Static in the sense that it is public-health guidance, not per-place
     data — served through the API layer exactly like everything else so a
     real backend can override it (e.g. localized languages, updated
     protocols) without any front-end changes.
     ======================================================================= */
  const VULNERABLE_GROUPS = [
    {
      id: "infants",
      title: "Infants & young children",
      note:
        "Limited ability to regulate body temperature and communicate thirst. Watch for lethargy, dry nappies, and sunken eyes.",
      susceptibility: 1.0,
    },
    {
      id: "elderly",
      title: "Elderly (65+)",
      note:
        "Reduced sweating response and often on medications that affect heat tolerance. Highest heat-related mortality group.",
      susceptibility: 1.0,
    },
    {
      id: "pregnant",
      title: "Pregnant women",
      note:
        "Higher core body temperature and cardiovascular load increase risk of heat exhaustion and dehydration-related complications.",
      susceptibility: 0.85,
    },
    {
      id: "chronic-illness",
      title: "People with chronic illness",
      note:
        "Heart disease, kidney disease, diabetes and respiratory conditions all reduce the body's ability to cope with heat stress.",
      susceptibility: 0.9,
    },
    {
      id: "outdoor-workers",
      title: "Outdoor & manual workers",
      note:
        "Construction, farming, vending and delivery workers face prolonged midday sun exposure and physical exertion.",
      susceptibility: 0.75,
    },
    {
      id: "homeless",
      title: "Homeless & informal settlements",
      note:
        "Little or no access to shade, cooling or drinking water through the hottest hours of the day.",
      susceptibility: 0.8,
    },
  ];

  // Derives a 0-100 vulnerability score for a group from a ward's heat
  // index and that group's general susceptibility weight — computed, not
  // stored, so it always reflects the ward actually selected.
  function vulnerabilityScore(heatIndexC, susceptibility) {
    const raw = (heatIndexC - 20) * susceptibility * 3;
    return Math.round(Math.max(4, Math.min(100, raw)));
  }

  const SAFETY_GUIDELINES = {
    dos: [
      "Drink water regularly through the day, even before you feel thirsty.",
      "Use ORS or a home-made salt-sugar-lemon solution if sweating heavily.",
      "Stay indoors or in shade between 12 PM and 4 PM, the peak heat window.",
      "Wear light-coloured, loose, cotton clothing and a wet cloth or hat outdoors.",
      "Check on elderly neighbours, infants and anyone living alone each day.",
      "Keep animals and pets hydrated and in shaded, ventilated spaces.",
      "Use curtains, shutters or damp cloths on windows to keep rooms cooler.",
    ],
    donts: [
      "Don't go outdoors between 12 PM and 4 PM unless absolutely necessary.",
      "Don't leave children, elderly people or pets inside parked vehicles.",
      "Avoid alcohol, tea, coffee and carbonated or sugary cold drinks.",
      "Avoid strenuous outdoor work or exercise during peak heat hours.",
      "Don't wear dark or tight synthetic clothing in direct sun.",
      "Don't skip meals — eat light, and include water-rich fruit and vegetables.",
      "Don't ignore dizziness, cramps, nausea or a stopped-sweating episode — treat as a warning sign.",
    ],
  };

  function emergencyContactsFor(cityId) {
    // Nationally consistent numbers are real. City/state-specific lines
    // below are ROUGH SAMPLE VALUES for this demo — replace with your
    // verified local helpline numbers before using this in production.
    const meta = CITY_META[cityId];
    const localSample = {
      vijayawada: [
        { label: "NTR District Disaster Management Cell", value: "0866-246 0400 (sample)" },
        { label: "Vijayawada Municipal Corporation Control Room", value: "0866-257 1665 (sample)" },
        { label: "GGH Vijayawada — Heat Stroke Ward", value: "0866-247 4707 (sample)" },
      ],
      aynavolu: [
        { label: "Krishna District Disaster Management Cell", value: "0866-252 0777 (sample)" },
        { label: "Aynavolu Panchayat Control Room", value: "0866-259 3312 (sample)" },
        { label: "Nearest PHC — Heat Advisory Desk", value: "0866-259 4488 (sample)" },
      ],
    };
    return [
      { label: "National Emergency Number", value: "112" },
      { label: "Ambulance", value: "108" },
      { label: "Fire Services", value: "101" },
      { label: "Police", value: "100" },
      ...(localSample[cityId] || []),
    ];
  }

  /* =======================================================================
     CITY & WARD DATA (simulator)
     ======================================================================= */
  const CITY_META = {
    vijayawada: {
      id: "vijayawada",
      name: "Vijayawada",
      subtitle: "NTR District, Andhra Pradesh",
      unitLabel: "Ward",
      unitCount: 64,
      zones: 3,
      baseTemp: 42.5,
      baseHumidity: 42,
    },
    aynavolu: {
      id: "aynavolu",
      name: "Aynavolu",
      subtitle: "Krishna District, Andhra Pradesh",
      unitLabel: "Locality",
      unitCount: 14,
      zones: 1,
      baseTemp: 40.5,
      baseHumidity: 48,
    },
  };

  function buildWards(cityId) {
    const meta = CITY_META[cityId];
    const wards = [];
    for (let i = 1; i <= meta.unitCount; i++) {
      const seed = `${cityId}-${i}`;
      const rand = rngFor(seed);
      const tempJitter = (rand() - 0.5) * 6; // +/-3C
      const humJitter = (rand() - 0.5) * 24; // +/-12%
      const temp = Math.round((meta.baseTemp + tempJitter) * 10) / 10;
      const humidity = Math.max(
        15,
        Math.min(85, Math.round(meta.baseHumidity + humJitter))
      );
      // Demo-only: seeded directly, not calculated from temp/humidity.
      const risk = pickWardRisk(rand);
      const heatIndex = simulatedThermalStress(rand, risk);
      const zone =
        meta.zones > 1 ? (i % meta.zones === 0 ? meta.zones : i % meta.zones) : 1;
      wards.push({
        id: `${cityId}-${i}`,
        number: i,
        name: `${meta.unitLabel} ${i}`,
        zone,
        temp,
        humidity,
        heatIndex,
        risk,
        mostAffected: pickMostAffected(rand, risk),
      });
    }
    return wards;
  }

  function pickMostAffected(rand, risk) {
    const pool =
      risk === "red"
        ? ["infants", "pregnant", "elderly", "outdoor-workers", "chronic-illness"]
        : risk === "yellow"
        ? ["elderly", "outdoor-workers", "infants"]
        : ["elderly", "infants"];
    const count = risk === "red" ? 4 : risk === "yellow" ? 3 : 2;
    const shuffled = [...pool].sort(() => rand() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  function cityOverviewFromWards(cityId, wards) {
    const meta = CITY_META[cityId];
    const avgTemp =
      wards.reduce((s, w) => s + w.temp, 0) / wards.length;
    const avgHum =
      wards.reduce((s, w) => s + w.humidity, 0) / wards.length;
    // Average of each ward's already-seeded demo figure — an aggregate,
    // not a heat-index calculation (see pickWardRisk / simulatedThermalStress).
    const avgThermalStress =
      wards.reduce((s, w) => s + w.heatIndex, 0) / wards.length;
    const counts = { red: 0, yellow: 0, green: 0 };
    wards.forEach((w) => counts[w.risk]++);
    // Overall band = worst band present, mirroring how a dispatcher would
    // read a ward map: one red ward puts the city on alert.
    const risk = counts.red > 0 ? "red" : counts.yellow > 0 ? "yellow" : "green";
    return {
      cityId,
      name: meta.name,
      subtitle: meta.subtitle,
      temp: Math.round(avgTemp * 10) / 10,
      humidity: Math.round(avgHum),
      heatIndex: Math.round(avgThermalStress * 10) / 10,
      risk,
      unitLabel: meta.unitLabel,
      unitCount: meta.unitCount,
      riskCounts: counts,
      lastUpdated: new Date().toISOString(),
    };
  }

  /* =======================================================================
     MOCK PROVIDER — implements the same routes a real backend would
     ======================================================================= */
  const MOCK_PROVIDER = {
    async cities() {
      return Object.values(CITY_META).map((m) => ({
        id: m.id,
        name: m.name,
        subtitle: m.subtitle,
      }));
    },
    async overview(cityId) {
      const wards = buildWards(cityId);
      return cityOverviewFromWards(cityId, wards);
    },
    async wards(cityId) {
      return buildWards(cityId);
    },
    async ward(cityId, wardId) {
      const wards = buildWards(cityId);
      return wards.find((w) => w.id === wardId) || null;
    },
    async alerts(cityId) {
      const wards = buildWards(cityId);
      const overview = cityOverviewFromWards(cityId, wards);
      const alerts = [];
      if (overview.risk === "red") {
        alerts.push({
          level: "red",
          headline: `Extreme heat warning — ${overview.name}`,
          detail: `Heat index averaging ${overview.heatIndex}\u00B0C across the city. Avoid outdoor exposure 12 PM–4 PM.`,
        });
      } else if (overview.risk === "yellow") {
        alerts.push({
          level: "yellow",
          headline: `Heat advisory — ${overview.name}`,
          detail: `Heat index averaging ${overview.heatIndex}\u00B0C. Vulnerable groups should limit midday outdoor activity.`,
        });
      } else {
        alerts.push({
          level: "green",
          headline: `Conditions normal — ${overview.name}`,
          detail: `Heat index averaging ${overview.heatIndex}\u00B0C. No heat advisory in effect.`,
        });
      }
      const redWards = wards.filter((w) => w.risk === "red").length;
      if (redWards > 0) {
        alerts.push({
          level: "red",
          headline: `${redWards} ${overview.unitLabel.toLowerCase()}${redWards > 1 ? "s" : ""} at high alert`,
          detail: `${redWards} of ${overview.unitCount} ${overview.unitLabel.toLowerCase()}s are currently in the high-risk band.`,
        });
      }
      return alerts;
    },
    async emergencyContacts(cityId) {
      return emergencyContactsFor(cityId);
    },
    async vulnerableGroups() {
      return VULNERABLE_GROUPS;
    },
    async safetyGuidelines() {
      return SAFETY_GUIDELINES;
    },
    // Fallback shape only used if API_BASE_URL is ever unset — matches the
    // real /dashboard/{location} response shape from the FastAPI backend.
    async dashboard(cityId) {
      const wards = buildWards(cityId);
      const overview = cityOverviewFromWards(cityId, wards);
      const level =
        overview.risk === "red" ? "HIGH" : overview.risk === "yellow" ? "MODERATE" : "LOW";
      return {
        location: CITY_META[cityId].name,
        weather: {
          temperature: overview.temp,
          humidity: overview.humidity,
          wind_speed: null,
          solar_radiation: null,
          pressure: null,
          dew_point: null,
        },
        thermal_stress: { index: overview.heatIndex, level },
        risk: { score: null, level, confidence: null },
        recommendations: [],
      };
    },
    async forecast() {
      return [];
    },
  };

  /* =======================================================================
     API LAYER — the only thing the UI talks to.
     Swaps transparently between a live backend and the mock provider.
     ======================================================================= */
  // Only /dashboard/{location} and /forecast/{location} exist on the real
  // backend, so only these two ever fetch over the network — and only
  // these two need the "aynavolu" -> "Ainavolu" casing fix, applied via
  // LOCATION_PARAM below.
  async function requestLive(path, mockFn) {
    if (USING_LIVE_API) {
      const res = await fetch(`${API_BASE_URL}${path}`);
      if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
      return res.json();
    }
    await delay(120 + Math.random() * 260);
    return mockFn();
  }

  // Everything else has no backend route yet, so it always goes to
  // MOCK_PROVIDER — never attempted against the live API, live or not —
  // matching how it's labelled in the UI (demo ward map, etc).
  async function requestDemo(mockFn) {
    await delay(80 + Math.random() * 180);
    return mockFn();
  }

  const api = {
    getCities: () => requestDemo(() => MOCK_PROVIDER.cities()),
    getCityOverview: (cityId) =>
      requestDemo(() => MOCK_PROVIDER.overview(cityId)),
    getWards: (cityId) => requestDemo(() => MOCK_PROVIDER.wards(cityId)),
    getWard: (cityId, wardId) =>
      requestDemo(() => MOCK_PROVIDER.ward(cityId, wardId)),
    getAlerts: (cityId) => requestDemo(() => MOCK_PROVIDER.alerts(cityId)),
    getEmergencyContacts: (cityId) =>
      requestDemo(() => MOCK_PROVIDER.emergencyContacts(cityId)),
    getVulnerableGroups: () =>
      requestDemo(() => MOCK_PROVIDER.vulnerableGroups()),
    getSafetyGuidelines: () =>
      requestDemo(() => MOCK_PROVIDER.safetyGuidelines()),
    getDashboard: (cityId) =>
      requestLive(`/dashboard/${LOCATION_PARAM[cityId] || cityId}`, () =>
        MOCK_PROVIDER.dashboard(cityId)
      ),
    getForecast: (cityId) =>
      requestLive(`/forecast/${LOCATION_PARAM[cityId] || cityId}`, () =>
        MOCK_PROVIDER.forecast(cityId)
      ),
  };

  /* =======================================================================
     STATE
     ======================================================================= */
  const state = {
    activeCity: "vijayawada",
    selectedWard: null,
    wardsCache: {},
    dashboardCache: {},
  };

  /* =======================================================================
     RENDER HELPERS
     ======================================================================= */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function riskDotHTML(risk) {
    return `<span class="risk-dot risk-${risk}" aria-hidden="true"></span>`;
  }

  function fmtGroupNames(ids) {
    const map = {};
    VULNERABLE_GROUPS.forEach((g) => (map[g.id] = g.title));
    return ids.map((id) => map[id] || id).join(", ");
  }

  // City cards now come straight from the FastAPI /dashboard/{location}
  // response — no fabricated temperature/humidity/thermal-stress values
  // once a live backend is connected.
  async function renderCityCards() {
    const wrap = $("#city-cards");
    wrap.innerHTML = `<div class="loading-row">Reading live sensor feed…</div>`;
    const cityIds = Object.keys(CITY_META);
    const dashboards = await Promise.all(cityIds.map((id) => api.getDashboard(id)));
    cityIds.forEach((id, i) => (state.dashboardCache[id] = dashboards[i]));

    wrap.innerHTML = cityIds
      .map((id, i) => {
        const meta = CITY_META[id];
        const d = dashboards[i] || {};
        const level = d.risk && d.risk.level;
        const color = riskColorFromLevel(level);
        const temp = safeVal(d.weather && d.weather.temperature);
        const hum = safeVal(d.weather && d.weather.humidity);
        const thermalIdx = safeVal(d.thermal_stress && d.thermal_stress.index);
        return `
      <button class="city-card risk-border-${color} ${
          id === state.activeCity ? "is-active" : ""
        }" data-city="${id}">
        <div class="city-card-top">
          <h3>${meta.name}</h3>
          ${riskDotHTML(color)}
        </div>
        <p class="city-card-subtitle">${meta.subtitle}</p>
        <div class="city-card-stats">
          <div><span class="stat-num">${temp}${typeof temp === "number" ? "°C" : ""}</span><span class="stat-label">Temperature</span></div>
          <div><span class="stat-num">${hum}${typeof hum === "number" ? "%" : ""}</span><span class="stat-label">Rel. Humidity</span></div>
          <div><span class="stat-num">${thermalIdx}</span><span class="stat-label">Thermal Stress Index</span></div>
        </div>
        <div class="city-card-risk risk-text-${color}">${titleCase(level) || "N/A"}</div>
      </button>`;
      })
      .join("");

    $$(".city-card", wrap).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCity = btn.dataset.city;
        state.selectedWard = null;
        renderAll();
        const mapSection = $("#ward-map-section");
        if (mapSection) {
          mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // Driven by the same live dashboard object as the city cards, so the
  // ticker never shows a number that didn't come from the backend.
  async function renderAlerts() {
    const wrap = $("#alert-ticker");
    const cityId = state.activeCity;
    const meta = CITY_META[cityId];
    const dash = state.dashboardCache[cityId] || (await api.getDashboard(cityId));
    const level = dash.risk && dash.risk.level;
    const color = riskColorFromLevel(level);
    const copy = EARLY_WARNING_COPY[String(level || "LOW").toUpperCase()] || EARLY_WARNING_COPY.LOW;
    const detail =
      (Array.isArray(dash.recommendations) && dash.recommendations[0]) || copy.action;
    wrap.innerHTML = `
      <div class="alert-pill risk-bg-${color}">
        <span class="alert-pill-badge">${(level || "INFO").toString().toUpperCase()}</span>
        <span class="alert-pill-text"><strong>${titleCase(level) || "Conditions"} — ${meta.name}.</strong> ${detail}</span>
      </div>`;
  }

  // Risk card + Early Warning card — both scoped to the active city and
  // both re-render whenever the user switches between Vijayawada and
  // Ainavolu.
  async function renderConditions() {
    const cityId = state.activeCity;
    const meta = CITY_META[cityId];
    const label = $("#conditions-city-label");
    if (label) label.textContent = meta.name;

    const dash = state.dashboardCache[cityId] || (await api.getDashboard(cityId));
    const level = dash.risk && dash.risk.level;
    const color = riskColorFromLevel(level);
    const score = safeVal(dash.risk && dash.risk.score);
    const confidence = safeVal(dash.risk && dash.risk.confidence);
    const recs = Array.isArray(dash.recommendations) ? dash.recommendations : [];

    const riskCard = $("#risk-card");
    if (riskCard) {
      riskCard.innerHTML = `
        <h3>Risk Assessment</h3>
        <div class="ward-detail-stats">
          <div><span class="stat-num risk-text-${color}">${titleCase(level) || "N/A"}</span><span class="stat-label">Risk Level</span></div>
          <div><span class="stat-num">${score}</span><span class="stat-label">Risk Score</span></div>
          <div><span class="stat-num">${confidence}</span><span class="stat-label">Confidence</span></div>
        </div>
        <div class="ward-detail-affected">
          <h4>Recommendations</h4>
          ${
            recs.length
              ? `<ul class="recommendations-list">${recs.map((r) => `<li>${r}</li>`).join("")}</ul>`
              : `<p class="muted">No specific recommendations returned for this location yet.</p>`
          }
        </div>
      `;
    }

  }

  // A dedicated, always-visible rectangular Early Warning box. Built with
  // its own inline-styled border/background (not dependent on an external
  // stylesheet class existing) so the alert box reliably renders as a
  // clear box regardless of what CSS is loaded. Colour and copy come from
  // the same live dashboard object used everywhere else on the page — no
  // separate calculation happens here.
  const RISK_HEX = { red: "#e8432b", yellow: "#f5a623", green: "#3fa76b" };

  function ensureEarlyWarningContainer() {
    let el = $("#early-warning-card");
    if (el) return el;
    // Fallback: if the page's HTML doesn't have the container yet, create
    // one and place it right after the city cards so the feature works
    // even before the HTML is updated to include it explicitly.
    el = document.createElement("div");
    el.id = "early-warning-card";
    const anchor = $("#city-cards");
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(el, anchor.nextSibling);
    } else {
      document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }

  async function renderEarlyWarning() {
    const cityId = state.activeCity;
    const meta = CITY_META[cityId];
    const dash = state.dashboardCache[cityId] || (await api.getDashboard(cityId));
    const level = dash.risk && dash.risk.level;
    const color = riskColorFromLevel(level);
    const hex = RISK_HEX[color] || RISK_HEX.green;
    const copy =
      EARLY_WARNING_COPY[String(level || "LOW").toUpperCase()] || EARLY_WARNING_COPY.LOW;

    const el = ensureEarlyWarningContainer();
    el.innerHTML = `
      <div class="early-warning-box risk-border-${color}"
           style="border:2px solid ${hex}; border-radius:12px; padding:16px 18px;
                  background:${hex}1a; margin:16px 0;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong style="letter-spacing:0.03em;">⚠️ EARLY WARNING — ${meta.name}</strong>
          <span class="risk-chip risk-bg-${color}"
                style="background:${hex}; color:#1b120c; font-weight:700; font-size:11px;
                       text-transform:uppercase; letter-spacing:0.06em; padding:4px 10px; border-radius:20px;">
            ${titleCase(level) || "N/A"}
          </span>
        </div>
        <p style="margin-top:8px;">${copy.action}</p>
        <p class="muted" style="margin-top:4px; opacity:0.85;">${copy.note}</p>
      </div>`;
  }

  // Best-effort normalizer: the exact /forecast/{location} response shape
  // wasn't confirmed, so this reads either flat or nested (weather /
  // thermal_stress / risk) fields and falls back to "N/A" rather than
  // ever showing {} or null.
  function normalizeForecastEntry(item) {
    item = item || {};
    const weather = item.weather || item;
    const thermal = item.thermal_stress || item;
    const risk = item.risk || item;
    return {
      period: item.time || item.period || item.date || item.day || item.label || "",
      temperature: safeVal(weather.temperature),
      thermalIndex: safeVal(thermal.index !== undefined ? thermal.index : item.thermal_stress_index),
      thermalLevel: thermal.level !== undefined ? thermal.level : item.thermal_stress_level,
      riskLevel: risk.level !== undefined ? risk.level : item.risk_level,
    };
  }

  async function renderForecast() {
    const cityId = state.activeCity;
    const meta = CITY_META[cityId];
    const label = $("#forecast-city-label");
    if (label) label.textContent = meta.name;

    const wrap = $("#forecast-list");
    if (!wrap) return;

    const raw = await api.getForecast(cityId);
    const list = Array.isArray(raw)
      ? raw
      : (raw && (raw.forecast || raw.periods || raw.data)) || [];

    if (!list.length) {
      wrap.innerHTML = `<p class="muted">No forecast data returned by the backend for ${meta.name} yet.</p>`;
      return;
    }

    wrap.innerHTML = list
      .map((item) => {
        const f = normalizeForecastEntry(item);
        const color = riskColorFromLevel(f.riskLevel);
        return `
        <div class="forecast-item">
          <span class="eyebrow">${f.period || "—"}</span>
          <div class="stat-num">${f.temperature}${typeof f.temperature === "number" ? "°C" : ""}</div>
          <span class="stat-label">Temperature</span>
          <div class="stat-num risk-text-${color}">${f.thermalIndex}</div>
          <span class="stat-label">Thermal Stress</span>
        </div>`;
      })
      .join("");
  }

  async function renderWardMap() {
    const meta = CITY_META[state.activeCity];
    $("#ward-map-title").textContent = `${meta.name} — Demo Ward Map`;
    $("#ward-map-sub").textContent = `DEMO DATA · ${meta.unitCount} simulated ${meta.unitLabel.toLowerCase()}s, not live backend data · click any cell for details`;

    const wards = await api.getWards(state.activeCity);
    state.wardsCache[state.activeCity] = wards;

    const cols = Math.ceil(Math.sqrt(wards.length * 1.5));
    const cellSize = 40;
    const gap = 4;
    const width = cols * (cellSize + gap) - gap;
    const rows = Math.ceil(wards.length / cols);
    const height = rows * (cellSize + gap) - gap;

    let cells = "";
    wards.forEach((w, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = col * (cellSize + gap);
      const y = row * (cellSize + gap);
      cells += `
        <g class="ward-cell" tabindex="0" role="button"
           aria-label="${w.name}, ${RISK_LABEL[w.risk]}"
           data-ward="${w.id}">
          <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}"
                rx="6" class="ward-rect risk-fill-${w.risk}"></rect>
          <text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 4}"
                class="ward-label">${w.number}</text>
        </g>`;
    });

    $("#ward-map-svg").setAttribute("viewBox", `0 0 ${width} ${height}`);
    $("#ward-map-svg").innerHTML = cells;

    $$(".ward-cell", $("#ward-map-svg")).forEach((el) => {
      const open = () => {
        state.selectedWard = el.dataset.ward;
        renderWardDetail();
        if (window.innerWidth < 860) {
          const detail = $("#ward-detail");
          if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });

    if (!state.selectedWard && wards.length) {
      const worst =
        wards.find((w) => w.risk === "red") ||
        wards.find((w) => w.risk === "yellow") ||
        wards[0];
      state.selectedWard = worst.id;
    }
    renderWardDetail();
  }

  async function renderWardDetail() {
    const panel = $("#ward-detail");
    if (!state.selectedWard) {
      panel.innerHTML = `<p class="muted">Select a ${CITY_META[state.activeCity].unitLabel.toLowerCase()} on the map to see its details.</p>`;
      return;
    }
    const ward = await api.getWard(state.activeCity, state.selectedWard);
    if (!ward) return;
    panel.innerHTML = `
      <div class="ward-detail-head">
        <div>
          <span class="eyebrow">${CITY_META[state.activeCity].name} · ${CITY_META[state.activeCity].unitLabel} ${ward.number}</span>
          <h3>${ward.name}</h3>
        </div>
        <div class="risk-chip risk-bg-${ward.risk}">${RISK_LABEL[ward.risk]}</div>
      </div>
      <div class="ward-detail-stats">
        <div><span class="stat-num">${ward.temp}°C</span><span class="stat-label">Temperature</span></div>
        <div><span class="stat-num">${ward.humidity}%</span><span class="stat-label">Rel. Humidity</span></div>
        <div><span class="stat-num">${ward.heatIndex}°C</span><span class="stat-label">Thermal Stress (demo)</span></div>
      </div>
      <div class="ward-detail-affected">
        <h4>Most likely to be affected here</h4>
        <p>${fmtGroupNames(ward.mostAffected)}</p>
      </div>
      <div class="ward-detail-chart">
        <h4>Vulnerability by group</h4>
        ${vulnerabilityChartHTML(ward)}
      </div>
    `;
  }

  function vulnerabilityChartHTML(ward) {
    const rows = VULNERABLE_GROUPS.map((g) => ({
      title: g.title,
      score: vulnerabilityScore(ward.heatIndex, g.susceptibility),
    })).sort((a, b) => b.score - a.score);

    return `
      <div class="vuln-chart" role="img" aria-label="Vulnerability scores by group for ${ward.name}">
        ${rows
          .map((r) => {
            const barRisk =
              r.score >= 65 ? "red" : r.score >= 40 ? "yellow" : "green";
            return `
            <div class="vuln-row">
              <span class="vuln-row-label">${r.title}</span>
              <div class="vuln-row-track">
                <div class="vuln-row-fill risk-fill-${barRisk}" style="width:${r.score}%"></div>
              </div>
              <span class="vuln-row-value">${r.score}</span>
            </div>`;
          })
          .join("")}
      </div>
    `;
  }

  async function renderVulnerableGroups() {
    const wrap = $("#vulnerable-groups");
    const groups = await api.getVulnerableGroups();
    wrap.innerHTML = groups
      .map(
        (g) => `
      <div class="group-card">
        <h4>${g.title}</h4>
        <p>${g.note}</p>
      </div>`
      )
      .join("");
  }

  async function renderSafety() {
    const guidelines = await api.getSafetyGuidelines();
    $("#dos-list").innerHTML = guidelines.dos
      .map((d) => `<li>${d}</li>`)
      .join("");
    $("#donts-list").innerHTML = guidelines.donts
      .map((d) => `<li>${d}</li>`)
      .join("");

    const contacts = await api.getEmergencyContacts(state.activeCity);
    const cityLabel = $("#contacts-city-label");
    if (cityLabel) {
      cityLabel.textContent = `For ${CITY_META[state.activeCity].name}`;
    }
    $("#contacts-list").innerHTML = contacts
      .map(
        (c) => `
      <div class="contact-row ${c.value.includes("(sample)") ? "is-sample" : ""}">
        <span class="contact-label">${c.label}</span>
        <span class="contact-value">${c.value}</span>
      </div>`
      )
      .join("");
  }

  function renderSourceBadge() {
    const el = $("#data-source-badge");
    el.textContent = USING_LIVE_API
      ? "Connected to FastAPI backend"
      : "Simulated data — no backend connected";
    el.classList.toggle("is-live", USING_LIVE_API);
  }

  async function renderAll() {
    renderSourceBadge();
    // City cards populate state.dashboardCache, so it runs first — alerts
    // and the conditions/forecast cards below then reuse that cached
    // dashboard instead of re-fetching it.
    await renderCityCards();
    await Promise.all([
      renderAlerts(),
      renderEarlyWarning(),
      renderConditions(),
    ]);
    await renderWardMap();
    await renderVulnerableGroups();
    await renderSafety();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAll();
  });
})();
