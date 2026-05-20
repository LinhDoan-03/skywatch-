// ── API ───────────────────────────────────────────────────────
const API_KEY = '803d373ae15a7f32f18708062b8ac325';
const BASE    = 'https://api.openweathermap.org/data/2.5';

// ── VILLES PRÉDÉFINIES (clé → requête API) ────────────────────
const CITY_QUERIES = {
  paris:       'Paris,FR',
  lyon:        'Lyon,FR',
  marseille:   'Marseille,FR',
  bordeaux:    'Bordeaux,FR',
  nice:        'Nice,FR',
  toulouse:    'Toulouse,FR',
  nantes:      'Nantes,FR',
  rennes:      'Rennes,FR',
  lille:       'Lille,FR',
  orleans:     'Orleans,FR',
  strasbourg:  'Strasbourg,FR',
  montpellier: 'Montpellier,FR',
};

// Cache des données API
const cityDB = {};

// ── VARIABLES GLOBALES ────────────────────────────────────────
let currentCity    = 'paris';
let compareCities  = ['paris', 'lyon', 'bordeaux', 'nice', 'toulouse', 'nantes', 'rennes', 'lille', 'orleans', 'strasbourg'];
let recentSearches = [];
let hourlyChart    = null;
let demoActive = false, demoStep = 0, demoTimer = null;
let manualBg = false;

// ── EMOJI MÉTÉO ───────────────────────────────────────────────
function getWeatherEmoji(id, icon) {
  const night = icon && icon.endsWith('n');
  if (id >= 200 && id < 300) return '⛈️';
  if (id >= 300 && id < 400) return '🌦️';
  if (id >= 500 && id < 600) return id < 502 ? '🌧️' : '🌨️';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫️';
  if (id === 800) return night ? '🌙' : '☀️';
  if (id === 801) return '🌤️';
  if (id >= 802) return '☁️';
  return '🌡️';
}

// ── FETCH MÉTÉO DEPUIS L'API ──────────────────────────────────
async function fetchCityData(query) {
  const [wRes, fRes] = await Promise.all([
    fetch(`${BASE}/weather?q=${encodeURIComponent(query)}&appid=${API_KEY}&units=metric&lang=fr`),
    fetch(`${BASE}/forecast?q=${encodeURIComponent(query)}&appid=${API_KEY}&units=metric&lang=fr`),
  ]);

  const weather  = await wRes.json();
  const forecast = await fRes.json();

  if (!wRes.ok) throw new Error(weather.message || 'Ville introuvable');

  // Une entrée par jour (la plus proche de midi)
  const days = {};
  forecast.list.forEach(item => {
    const d    = new Date(item.dt * 1000);
    const dKey = d.toISOString().split('T')[0];
    const h    = d.getHours();
    if (!days[dKey] || Math.abs(h - 12) < Math.abs(new Date(days[dKey].dt * 1000).getHours() - 12))
      days[dKey] = item;
  });
  const DAY_NAMES = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const dailyForecast = Object.values(days).slice(0, 5).map(item => {
    const d = new Date(item.dt * 1000);
    return {
      day:  DAY_NAMES[d.getDay()],
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      temp: Math.round(item.main.temp),
      desc: item.weather[0].description,
      icon: getWeatherEmoji(item.weather[0].id, item.weather[0].icon),
    };
  });

  // Graphique horaire : 8 points toutes les 3h (= 24h)
  const hourlyItems  = forecast.list.slice(0, 8);
  const hourlyTemps  = hourlyItems.map(i => Math.round(i.main.temp));
  const hourlyLabels = hourlyItems.map(i => {
    const d = new Date(i.dt * 1000);
    return `${String(d.getHours()).padStart(2, '0')}h`;
  });

  const avgTemp = Math.round(hourlyTemps.reduce((a, b) => a + b, 0) / hourlyTemps.length);

  return {
    name:         `${weather.name}, ${weather.sys.country}`,
    temp:         Math.round(weather.main.temp),
    feels:        Math.round(weather.main.feels_like),
    avgTemp,
    humidity:     weather.main.humidity,
    wind:         Math.round(weather.wind.speed),
    desc:         weather.weather[0].description,
    icon:         getWeatherEmoji(weather.weather[0].id, weather.weather[0].icon),
    forecast:     dailyForecast,
    hourly:       hourlyTemps,
    hourlyLabels,
  };
}

// ── NORMALIZE / ALIAS ─────────────────────────────────────────
function normalize(s) {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/\s+/g, '');
}
function resolveKey(raw) {
  const key = normalize(raw);
  return CITY_QUERIES[key] ? key : null;
}

// ── DÉMO PRÉSENTATION ─────────────────────────────────────────
const DEMO_SEQUENCE = [
  { cls: 'time-dawn',      label: '🌅 Aube' },
  { cls: 'time-morning',   label: '☀️ Matin' },
  { cls: 'time-noon',      label: '🌞 Midi' },
  { cls: 'time-afternoon', label: '🌤️ Après-midi' },
  { cls: 'time-sunset',    label: '🌇 Coucher' },
  { cls: 'time-dusk',      label: '🌆 Crépuscule' },
  { cls: 'time-night',     label: '🌙 Nuit' },
];

function showDemoStep() {
  const s = DEMO_SEQUENCE[demoStep];
  document.body.className = s.cls;
  document.getElementById('demoBtn').textContent =
    `⏹  ${s.label}  (${demoStep + 1}/${DEMO_SEQUENCE.length})`;
}

function toggleDemo() {
  if (demoActive) {
    clearInterval(demoTimer); demoTimer = null;
    demoActive = false;
    document.getElementById('demoBtn').textContent = '▶ Présentation';
    updateSky();
  } else {
    demoActive = true; demoStep = 0;
    showDemoStep();
    demoTimer = setInterval(() => {
      demoStep++;
      if (demoStep >= DEMO_SEQUENCE.length) {
        clearInterval(demoTimer); demoTimer = null;
        demoActive = false;
        document.getElementById('demoBtn').textContent = '▶ Présentation';
        updateSky();
      } else {
        showDemoStep();
      }
    }, 3000);
  }
}

// ── CIEL DYNAMIQUE ────────────────────────────────────────────
function getTimeClass(h) {
  if (h >= 5  && h < 7)  return 'time-dawn';
  if (h >= 7  && h < 11) return 'time-morning';
  if (h >= 11 && h < 14) return 'time-noon';
  if (h >= 14 && h < 17) return 'time-afternoon';
  if (h >= 17 && h < 19) return 'time-sunset';
  if (h >= 19 && h < 22) return 'time-dusk';
  return 'time-night';
}
function updateSky() {
  if (demoActive || manualBg) return;
  const now  = new Date();
  const h    = now.getHours();
  document.body.className = getTimeClass(h);
  const pad  = n => String(n).padStart(2, '0');
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  document.getElementById('timeBadge').textContent =
    `${pad(h)}:${pad(now.getMinutes())} · ${days[now.getDay()]}`;
}

// ── ÉTOILES ───────────────────────────────────────────────────
function createStars() {
  const c = document.getElementById('stars');
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.cssText = [
      `left:${Math.random()*100}%`, `top:${Math.random()*60}%`,
      `--dur:${2+Math.random()*4}s`, `--delay:${Math.random()*4}s`,
      `width:${1+Math.random()*2}px`, `height:${1+Math.random()*2}px`,
    ].join(';');
    c.appendChild(s);
  }
}

// ── LOADING ───────────────────────────────────────────────────
function showLoading(on) {
  document.getElementById('currentCard').style.opacity = on ? '0.5' : '1';
}

// ── AFFICHAGE MÉTÉO ACTUELLE ──────────────────────────────────
function renderCurrent(key) {
  const d = cityDB[key]; if (!d) return;
  document.getElementById('cityName').textContent    = d.name;
  document.getElementById('weatherDesc').textContent = d.desc;
  document.getElementById('weatherIcon').textContent = d.icon;
  document.getElementById('tempBig').textContent     = `${d.temp}°C`;
  document.getElementById('humidity').textContent    = `${d.humidity}%`;
  document.getElementById('wind').textContent        = `${d.wind} m/s`;
  document.getElementById('feelsLike').textContent   = `${d.avgTemp}°C`;
  const card = document.getElementById('currentCard');
  card.classList.remove('fade-in'); void card.offsetWidth; card.classList.add('fade-in');
}

// ── PRÉVISIONS 5 JOURS ────────────────────────────────────────
function renderForecast(key) {
  const d = cityDB[key]; if (!d) return;
  document.getElementById('forecastRow').innerHTML = d.forecast.map(f => `
    <div class="forecast-day fade-in">
      <div class="day-name">${f.day}</div>
      <div class="day-date">${f.date}</div>
      <div class="day-icon">${f.icon}</div>
      <div class="day-temp">${f.temp}°C</div>
      <div class="day-desc">${f.desc}</div>
    </div>
  `).join('');
}

// ── GRAPHIQUE 24H ─────────────────────────────────────────────
function renderChart(key) {
  const d = cityDB[key]; if (!d) return;
  const ctx = document.getElementById('hourlyChart').getContext('2d');
  if (hourlyChart) hourlyChart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0,   'rgba(96,165,250,0.45)');
  gradient.addColorStop(0.6, 'rgba(96,165,250,0.10)');
  gradient.addColorStop(1,   'rgba(96,165,250,0)');

  hourlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.hourlyLabels || d.hourly.map((_, i) => `${i*3}h`),
      datasets: [{
        label: 'Température (°C)',
        data: d.hourly,
        borderColor: '#60a5fa',
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#60a5fa',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#f59e0b',
        pointHoverBorderColor: '#fff',
        fill: true,
        tension: 0.45,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: 'easeInOutQuart',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.85)',
          borderColor: 'rgba(96,165,250,0.4)',
          borderWidth: 1,
          titleColor: 'rgba(226,232,240,0.7)',
          bodyColor: '#60a5fa',
          bodyFont: { size: 14, weight: '700' },
          padding: 10,
          callbacks: { label: ctx => ` ${ctx.parsed.y}°C` },
        },
      },
      scales: {
        x: {
          ticks: { color:'rgba(226,232,240,0.5)', font:{size:10}, maxRotation:0 },
          grid: { color:'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: { color:'rgba(226,232,240,0.5)', font:{size:11}, callback: v => v+'°' },
          grid: { color:'rgba(255,255,255,0.04)' },
        },
      },
      interaction: { intersect: false, mode: 'index' },
    },
  });
}

// ── CARTE LEAFLET ─────────────────────────────────────────────
const CITY_COORDS = {
  paris:       [48.8566,  2.3522],
  lyon:        [45.7640,  4.8357],
  marseille:   [43.2965,  5.3698],
  bordeaux:    [44.8378, -0.5792],
  nice:        [43.7102,  7.2620],
  toulouse:    [43.6047,  1.4442],
  nantes:      [47.2184, -1.5536],
  rennes:      [48.1173, -1.6778],
  lille:       [50.6292,  3.0573],
  orleans:     [47.9029,  1.9039],
  strasbourg:  [48.5734,  7.7521],
  montpellier: [43.6108,  3.8767],
};
let leafletMap = null, leafletMarkers = {};

function makeMarkerHtml(key) {
  const d  = cityDB[key];
  const bg = key === currentCity ? '#f59e0b' : '#60a5fa';
  const lbl = d ? `${d.icon} ${d.name.split(',')[0]} ${d.temp}°C` : key;
  return `<div style="background:${bg};color:#fff;border-radius:20px;padding:4px 10px;
    font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:600;
    border:2px solid white;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${lbl}</div>`;
}

function initMap() {
  if (leafletMap) return;
  leafletMap = L.map('leafletMap', { zoomControl: true, scrollWheelZoom: false })
                .setView([46.5, 2.5], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 18,
  }).addTo(leafletMap);
  Object.entries(CITY_COORDS).forEach(([key, latlng]) => {
    const marker = L.marker(latlng, {
      icon: L.divIcon({ className: '', html: makeMarkerHtml(key), iconAnchor:[0,0] }),
    }).addTo(leafletMap);
    marker.on('click', () => loadCity(key));
    leafletMarkers[key] = marker;
  });
}

function renderMap() {
  if (!leafletMap) return;
  Object.keys(CITY_COORDS).forEach(key => {
    if (leafletMarkers[key])
      leafletMarkers[key].setIcon(L.divIcon({ className:'', html: makeMarkerHtml(key), iconAnchor:[0,0] }));
  });
}

// ── INFO CARTE ────────────────────────────────────────────────
function showMapInfo(key) {
  const d = cityDB[key]; if (!d) return;
  const el = document.getElementById('mapInfo');
  el.style.display = 'block';
  document.getElementById('mapInfoContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="font-size:2.5rem">${d.icon}</div>
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700">${d.name}</div>
        <div style="color:var(--muted);font-size:0.85rem">${d.desc}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;color:var(--accent)">${d.temp}°C</div>
        <div style="font-size:0.8rem;color:var(--muted)">Ressenti : ${d.feels}°C</div>
      </div>
    </div>
    <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;align-items:center">
      <span style="font-size:0.82rem;color:var(--muted)">💧 ${d.humidity}%</span>
      <span style="font-size:0.82rem;color:var(--muted)">💨 ${d.wind} m/s</span>
      <button class="btn" style="margin-left:auto;padding:8px 16px;font-size:0.8rem"
        onclick="loadCity('${key}')">Voir les détails</button>
    </div>
  `;
}
function closeMapInfo() {
  document.getElementById('mapInfo').style.display = 'none';
}

// ── COMPARAISON ───────────────────────────────────────────────
function renderCompare() {
  const loaded  = compareCities.filter(k => cityDB[k]);
  if (!loaded.length) return;

  const maxTemp = Math.max(...loaded.map(k => cityDB[k].temp));
  document.getElementById('barCompare').innerHTML = loaded.map(key => {
    const d = cityDB[key];
    const pct = Math.round((d.temp / (maxTemp * 1.1)) * 100);
    return `<div class="bar-row">
      <div class="bar-city">${d.name.split(',')[0]}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-val">${d.temp}°C</div>
    </div>`;
  }).join('');
}

// ── CHARGER UNE VILLE ─────────────────────────────────────────
async function loadCity(key) {
  const query = CITY_QUERIES[key] || key;
  showLoading(true);
  try {
    if (!cityDB[key]) cityDB[key] = await fetchCityData(query);
    currentCity = key;
    renderCurrent(key); renderForecast(key); renderChart(key);
    renderMap(); renderCompare();
    recentSearches = [key, ...recentSearches.filter(k => k !== key)].slice(0, 5);
    renderRecent();
    document.getElementById('searchInput').value = cityDB[key].name;
  } catch (err) {
    const inp = document.getElementById('searchInput');
    inp.classList.add('error-shake'); inp.style.borderColor = '#ef4444';
    setTimeout(() => { inp.classList.remove('error-shake'); inp.style.borderColor=''; }, 1000);
  } finally {
    showLoading(false);
  }
}

// ── RECHERCHE ─────────────────────────────────────────────────
async function searchCity() {
  const input = document.getElementById('searchInput');
  const raw   = input.value.trim(); if (!raw) return;
  const key   = resolveKey(raw) || normalize(raw);
  if (!CITY_QUERIES[key]) CITY_QUERIES[key] = raw;
  cityDB[key] = null; // force re-fetch
  await loadCity(key);
}

function quickSearch(key) { loadCity(key); }

// ── HISTORIQUE ────────────────────────────────────────────────
function renderRecent() {
  const c = document.getElementById('recentTags');
  if (!recentSearches.length) { c.innerHTML = ''; return; }
  c.innerHTML = '<span style="font-size:0.8rem;color:var(--muted)">🕐 Récent :</span>' +
    recentSearches.map(k => `
      <div class="tag" onclick="loadCity('${k}')">
        ${cityDB[k]?.icon ?? '🌍'} ${cityDB[k]?.name.split(',')[0] ?? k}
      </div>`).join('');
}

// ── KEYBOARD ──────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchCity();
});
// ── DÉMARRAGE ─────────────────────────────────────────────────
createStars();
updateSky();
setInterval(updateSky, 10000);

loadCity('paris').then(() => {
  initMap();
  // Pré-charger les autres villes comparées en arrière-plan
  Object.keys(CITY_QUERIES).filter(k => k !== 'paris').forEach(key =>
    fetchCityData(CITY_QUERIES[key]).then(data => {
      cityDB[key] = data;
      renderCompare();
      renderMap();
    }).catch(() => {})
  );
});
