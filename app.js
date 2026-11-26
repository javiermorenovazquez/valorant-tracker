/* =========================================================
   Valorant Tracker · Javier Moreno Vázquez
   Registro de partidas y estadísticas con JavaScript puro:
   localStorage, filtros, ordenación, gráficas en <canvas>
   y análisis automático del rendimiento.
   ========================================================= */

const MAPS = ["Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture", "Pearl", "Lotus", "Sunset", "Abyss"];
const AGENTS = ["Jett", "Reyna", "Raze", "Phoenix", "Neon", "Yoru", "Iso", "Sage", "Killjoy", "Cypher", "Chamber",
  "Deadlock", "Vyse", "Sova", "Skye", "Breach", "KAY/O", "Fade", "Gekko", "Omen", "Brimstone", "Viper", "Astra",
  "Harbor", "Clove"];
const STORAGE_KEY = "valorant-tracker-v1";
const RESULT_TEXT = { win: "Victoria", loss: "Derrota", draw: "Empate" };

/* ---------- Estado ---------- */
let matches = load();
let sortState = { key: "date", dir: "desc" };

/* ---------- Utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const kd = (m) => (m.deaths === 0 ? m.kills : m.kills / m.deaths);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const fmt = (n, d = 2) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (iso) => new Date(iso + "T00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch {
    /* Si el navegador no permite guardar, la app sigue funcionando en memoria */
  }
}

/* ---------- Estadísticas ---------- */
function stats(list) {
  const kills = list.reduce((a, m) => a + m.kills, 0);
  const deaths = list.reduce((a, m) => a + m.deaths, 0);
  const assists = list.reduce((a, m) => a + m.assists, 0);
  const wins = list.filter((m) => m.result === "win").length;
  return {
    total: list.length,
    wins,
    winRate: list.length ? (wins / list.length) * 100 : 0,
    kd: deaths ? kills / deaths : kills,
    kda: deaths ? (kills + assists) / deaths : kills + assists,
    acs: avg(list.map((m) => m.acs)),
    hs: avg(list.map((m) => m.hs)),
  };
}

function groupBy(list, key) {
  return list.reduce((acc, m) => {
    (acc[m[key]] ||= []).push(m);
    return acc;
  }, {});
}

/* ---------- Render: KPIs ---------- */
function renderKPIs() {
  const s = stats(matches);
  const last5 = stats(sortedByDate(matches).slice(-5));
  const cls = (v, good, bad) => (v >= good ? "good" : v <= bad ? "bad" : "mid");

  const cards = [
    { label: "Partidas", value: s.total, extra: `${s.wins} victorias` },
    { label: "% Victorias", value: `${fmt(s.winRate, 0)} %`, css: cls(s.winRate, 55, 45), extra: `Últimas 5: ${fmt(last5.winRate, 0)} %` },
    { label: "K/D", value: fmt(s.kd), css: cls(s.kd, 1.1, 0.9), extra: `Últimas 5: ${fmt(last5.kd)}` },
    { label: "KDA", value: fmt(s.kda), css: cls(s.kda, 1.5, 1.1), extra: "(Kills + Assists) / Deaths" },
    { label: "ACS medio", value: fmt(s.acs, 0), css: cls(s.acs, 230, 180), extra: "Puntuación de combate" },
    { label: "% Headshot", value: `${fmt(s.hs, 1)} %`, css: cls(s.hs, 22, 15), extra: "Media de tiros a la cabeza" },
  ];

  $("#kpis").innerHTML = cards
    .map((c) => `<div class="kpi"><span>${c.label}</span><strong class="${c.css || ""}">${matches.length ? c.value : "–"}</strong><small>${matches.length ? c.extra : ""}</small></div>`)
    .join("");
}

/* ---------- Render: tabla ---------- */
function sortedByDate(list) {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

function filteredMatches() {
  const map = $("#filterMap").value;
  const agent = $("#filterAgent").value;
  const result = $("#filterResult").value;
  return matches.filter((m) => (!map || m.map === map) && (!agent || m.agent === agent) && (!result || m.result === result));
}

function renderTable() {
  const getters = {
    date: (m) => m.date, map: (m) => m.map, agent: (m) => m.agent, result: (m) => m.result,
    kda: (m) => m.kills, kd: (m) => kd(m), acs: (m) => m.acs, hs: (m) => m.hs,
  };
  const get = getters[sortState.key];
  const rows = filteredMatches().sort((a, b) => {
    const va = get(a), vb = get(b);
    const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
    return sortState.dir === "asc" ? cmp : -cmp;
  });

  $("#tableBody").innerHTML = rows
    .map((m) => `
      <tr>
        <td>${fmtDate(m.date)}</td>
        <td>${escapeHTML(m.map)}</td>
        <td>${escapeHTML(m.agent)}</td>
        <td><span class="tag ${m.result}">${RESULT_TEXT[m.result]}</span></td>
        <td>${m.kills} / ${m.deaths} / ${m.assists}</td>
        <td class="${kd(m) >= 1 ? "good" : "bad"}">${fmt(kd(m))}</td>
        <td>${m.acs}</td>
        <td>${m.hs} %</td>
        <td><button class="del" data-id="${m.id}" title="Borrar partida" aria-label="Borrar partida">✕</button></td>
      </tr>`)
    .join("");

  $("#emptyMsg").style.display = rows.length ? "none" : "block";
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.classList.toggle("asc", th.dataset.sort === sortState.key && sortState.dir === "asc");
    th.classList.toggle("desc", th.dataset.sort === sortState.key && sortState.dir === "desc");
  });
}

/* ---------- Gráficas en canvas (sin librerías) ---------- */
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = Number(canvas.getAttribute("height"));
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.font = "12px Inter, sans-serif";
  return { ctx, width, height };
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = "#8b97a6";
  ctx.textAlign = "center";
  ctx.fillText("Sin datos todavía", width / 2, height / 2);
}

function drawKDChart() {
  const { ctx, width, height } = setupCanvas($("#kdChart"));
  const data = sortedByDate(matches).slice(-20).map(kd);
  if (data.length < 2) return drawEmpty(ctx, width, height);

  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const max = Math.max(2, Math.ceil(Math.max(...data) * 2) / 2);
  const x = (i) => pad.l + (i / (data.length - 1)) * (width - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (height - pad.t - pad.b);

  // Rejilla y eje
  ctx.strokeStyle = "#273240";
  ctx.fillStyle = "#8b97a6";
  ctx.textAlign = "right";
  for (let v = 0; v <= max; v += 0.5) {
    ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(width - pad.r, y(v)); ctx.stroke();
    if (v % 1 === 0) ctx.fillText(v.toFixed(1), pad.l - 6, y(v) + 4);
  }

  // Línea de referencia K/D = 1
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#f5c451";
  ctx.beginPath(); ctx.moveTo(pad.l, y(1)); ctx.lineTo(width - pad.r, y(1)); ctx.stroke();
  ctx.setLineDash([]);

  // Área bajo la curva
  const grad = ctx.createLinearGradient(0, pad.t, 0, height - pad.b);
  grad.addColorStop(0, "rgba(255,70,85,.35)");
  grad.addColorStop(1, "rgba(255,70,85,0)");
  ctx.beginPath();
  ctx.moveTo(x(0), y(0));
  data.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(data.length - 1), y(0));
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Línea
  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = "#ff4655";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineWidth = 1;

  // Puntos
  data.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(v), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = v >= 1 ? "#2fd59a" : "#ff4655";
    ctx.fill();
  });
}

function drawMapChart() {
  const { ctx, width, height } = setupCanvas($("#mapChart"));
  const groups = Object.entries(groupBy(matches, "map"))
    .map(([map, list]) => ({ map, rate: stats(list).winRate, n: list.length }))
    .sort((a, b) => b.rate - a.rate);
  if (!groups.length) return drawEmpty(ctx, width, height);

  const pad = { l: 70, r: 78, t: 6, b: 6 };
  const rowH = (height - pad.t - pad.b) / groups.length;
  const barW = width - pad.l - pad.r;

  groups.forEach((g, i) => {
    const top = pad.t + i * rowH + rowH * 0.18;
    const h = rowH * 0.64;
    ctx.fillStyle = "#273240";
    ctx.fillRect(pad.l, top, barW, h);
    ctx.fillStyle = g.rate >= 55 ? "#2fd59a" : g.rate <= 45 ? "#ff4655" : "#f5c451";
    ctx.fillRect(pad.l, top, (g.rate / 100) * barW, h);

    ctx.fillStyle = "#ece8e1";
    ctx.textAlign = "right";
    ctx.fillText(g.map, pad.l - 8, top + h / 2 + 4);
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b97a6";
    ctx.fillText(`${Math.round(g.rate)} % (${g.n})`, pad.l + barW + 6, top + h / 2 + 4);
  });
}

/* ---------- Análisis automático ---------- */
function renderInsights() {
  const list = $("#insights");
  if (matches.length < 3) {
    list.innerHTML = "<li>Registra al menos 3 partidas para ver un análisis de tu rendimiento.</li>";
    return;
  }
  const tips = [];
  const s = stats(matches);

  const byMap = Object.entries(groupBy(matches, "map")).filter(([, l]) => l.length >= 2)
    .map(([k, l]) => ({ k, ...stats(l) })).sort((a, b) => b.winRate - a.winRate);
  if (byMap.length >= 2) {
    tips.push(`Tu mejor mapa es <strong>${byMap[0].k}</strong> (${fmt(byMap[0].winRate, 0)} % de victorias) y el peor <strong>${byMap.at(-1).k}</strong> (${fmt(byMap.at(-1).winRate, 0)} %). Practica o evita ${byMap.at(-1).k} en competitivo.`);
  }

  const byAgent = Object.entries(groupBy(matches, "agent")).filter(([, l]) => l.length >= 2)
    .map(([k, l]) => ({ k, ...stats(l) })).sort((a, b) => b.kd - a.kd);
  if (byAgent.length) {
    tips.push(`Con <strong>${byAgent[0].k}</strong> tienes tu mejor K/D (${fmt(byAgent[0].kd)}) y un ACS medio de ${fmt(byAgent[0].acs, 0)}. Es tu agente más fiable.`);
  }

  const recent = stats(sortedByDate(matches).slice(-5));
  const diff = recent.kd - s.kd;
  if (Math.abs(diff) >= 0.1) {
    tips.push(diff > 0
      ? `Vas a mejor: tu K/D en las últimas 5 partidas (${fmt(recent.kd)}) supera tu media (${fmt(s.kd)}).`
      : `Tus últimas 5 partidas están por debajo de tu media de K/D (${fmt(recent.kd)} frente a ${fmt(s.kd)}). Puede ser buen momento para un descanso.`);
  }

  if (s.hs < 18) tips.push(`Tu % de headshot medio es ${fmt(s.hs, 1)} %. Entrenar la colocación de mira a la altura de la cabeza puede subir mucho tu K/D.`);
  else tips.push(`Buen % de headshot (${fmt(s.hs, 1)} %). Tu puntería es un punto fuerte.`);

  list.innerHTML = tips.map((t) => `<li>${t}</li>`).join("");
}

/* ---------- Render general ---------- */
function render() {
  renderKPIs();
  renderTable();
  drawKDChart();
  drawMapChart();
  renderInsights();
}

/* ---------- Formulario ---------- */
function fillSelect(select, items, placeholder) {
  select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
    items.map((i) => `<option value="${i}">${i}</option>`).join("");
}

$("#matchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const num = (k) => Number(f.get(k));
  const match = {
    id: Date.now(),
    date: f.get("date"),
    map: f.get("map"),
    agent: f.get("agent"),
    result: f.get("result"),
    kills: num("kills"), deaths: num("deaths"), assists: num("assists"),
    acs: num("acs"), hs: num("hs"),
  };

  // Validación
  const err = $("#formError");
  if (!match.date) return (err.textContent = "Indica la fecha de la partida.");
  const fields = ["kills", "deaths", "assists", "acs", "hs"];
  if (fields.some((k) => f.get(k) === "" || Number.isNaN(match[k]) || match[k] < 0)) {
    return (err.textContent = "Rellena kills, deaths, assists, ACS y % headshot con números válidos.");
  }
  if (match.hs > 100) return (err.textContent = "El % de headshot no puede pasar de 100.");
  err.textContent = "";

  matches.push(match);
  save();
  render();
  e.target.reset();
  e.target.date.value = new Date().toISOString().slice(0, 10);
});

/* ---------- Eventos ---------- */
$("#tableBody").addEventListener("click", (e) => {
  const btn = e.target.closest(".del");
  if (!btn) return;
  matches = matches.filter((m) => m.id !== Number(btn.dataset.id));
  save();
  render();
});

document.querySelectorAll("th[data-sort]").forEach((th) =>
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    sortState = { key, dir: sortState.key === key && sortState.dir === "desc" ? "asc" : "desc" };
    renderTable();
  })
);

["#filterMap", "#filterAgent", "#filterResult"].forEach((id) => $(id).addEventListener("change", renderTable));

$("#btnDemo").addEventListener("click", () => {
  matches = demoData();
  save();
  render();
});

$("#btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(matches, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "partidas-valorant.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error();
    matches = data;
    save();
    render();
  } catch {
    $("#formError").textContent = "El archivo no tiene un formato válido.";
  }
  e.target.value = "";
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { drawKDChart(); drawMapChart(); }, 150);
});

/* ---------- Datos de ejemplo ---------- */
function demoData() {
  // Generador pseudoaleatorio con semilla para que la demo sea siempre igual
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const mains = ["Jett", "Reyna", "Omen", "Sova", "Killjoy"];
  const maps = ["Ascent", "Bind", "Haven", "Lotus", "Split", "Sunset"];
  const strength = { Ascent: 0.65, Bind: 0.45, Haven: 0.58, Lotus: 0.38, Split: 0.52, Sunset: 0.6 };
  const out = [];
  const start = new Date();
  start.setDate(start.getDate() - 30);

  for (let i = 0; i < 24; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + Math.floor(i * 1.25));
    const map = pick(maps);
    const agent = pick(mains);
    const form = 0.85 + (i / 24) * 0.35; // mejora con el tiempo
    const r = rand();
    const result = r < strength[map] ? "win" : r < strength[map] + 0.06 ? "draw" : "loss";
    const deaths = 10 + Math.floor(rand() * 9);
    const kills = Math.max(4, Math.round(deaths * (form + (rand() - 0.5) * 0.6) + (result === "win" ? 2 : -1)));
    out.push({
      id: i + 1,
      date: d.toISOString().slice(0, 10),
      map, agent, result, kills, deaths,
      assists: 2 + Math.floor(rand() * 9),
      acs: Math.round(120 + kills * 9 + rand() * 30),
      hs: Math.round(14 + rand() * 14),
    });
  }
  return out;
}

/* ---------- Inicio ---------- */
fillSelect($("#mapSelect"), MAPS);
fillSelect($("#agentSelect"), AGENTS);
fillSelect($("#filterMap"), MAPS, "Todos los mapas");
fillSelect($("#filterAgent"), AGENTS, "Todos los agentes");
$("#matchForm").date.value = new Date().toISOString().slice(0, 10);
render();
