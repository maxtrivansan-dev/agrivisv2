const FIREBASE_HOST =
  "https://melon-90d5c-default-rtdb.asia-southeast1.firebasedatabase.app";
const FIREBASE_AUTH = "Tq9h05HXs91mIvIevX8WpjQtFyDl1lvGnaSTjVYR";
const ROBOFLOW_KEY = "q4UPgFhZpQTxmloM5WA9";
const API_FRUIT = "https://serverless.roboflow.com/melon-az4ls/1";
const API_DISEASE = "https://serverless.roboflow.com/classification-cvb3q/12";
const TDS_MIN = 800,
  TDS_MAX = 1200,
  KIPAS_ON = 32,
  KIPAS_OFF = 29;
const DUMMY_MODE = false;

let mode = "auto",
  relays = [false, false, false, false],
  lastRefreshTime = Date.now();
let dummyTDS = 600,
  dummyTDSNaik = true,
  dummyDosing = false,
  dummyDosingStart = 0;

const aiState = {
  fruit: { file: null, base64: null, imgEl: null, naturalW: 0, naturalH: 0 },
  disease: { file: null, base64: null, imgEl: null, naturalW: 0, naturalH: 0 },
};

let pzemData = {
  voltage: 220,
  current: 1.2,
  power: 220,
  energy_kwh: 0.5,
  frequency: 50,
  power_factor: 0.95,
};
let powerHistory = [],
  costAccum = [],
  chartLabels = [],
  costChart = null;
const MAX_HIST = 24;

function isDark() {
  return window.matchMedia("(prefers-color-scheme:dark)").matches;
}

function initChart() {
  const ctx = document.getElementById("cost-chart").getContext("2d");
  const now = new Date();
  for (let i = MAX_HIST - 1; i >= 0; i--) {
    const t = new Date(now - i * 5 * 60 * 1000);
    chartLabels.push(
      t.getHours().toString().padStart(2, "0") +
        ":" +
        t.getMinutes().toString().padStart(2, "0"),
    );
    powerHistory.push(0);
    costAccum.push(0);
  }
  const textColor = isDark() ? "rgba(200,198,192,0.7)" : "rgba(90,90,85,0.8)";
  const gridColor = isDark() ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  costChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "Daya (W)",
          data: [...powerHistory],
          borderColor: "#7f77dd",
          backgroundColor: "rgba(127,119,221,0.12)",
          tension: 0.4,
          yAxisID: "y",
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2,
          fill: true,
        },
        {
          label: "Biaya Akumulatif (Rp)",
          data: [...costAccum],
          borderColor: "#1d9e75",
          backgroundColor: "rgba(29,158,117,0.1)",
          tension: 0.4,
          yAxisID: "y2",
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (ctx.datasetIndex === 0)
                return " Daya: " + ctx.parsed.y.toFixed(1) + " W";
              return (
                " Biaya: Rp " + Math.round(ctx.parsed.y).toLocaleString("id-ID")
              );
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: gridColor },
        },
        y: {
          position: "left",
          ticks: {
            color: "#7f77dd",
            font: { size: 10 },
            callback: (v) => v + "W",
          },
          grid: { color: gridColor },
        },
        y2: {
          position: "right",
          ticks: {
            color: "#1d9e75",
            font: { size: 10 },
            callback: (v) => "Rp" + Math.round(v / 1000) + "k",
          },
          grid: { display: false },
        },
      },
    },
  });
}

function updateChartData(power) {
  const tariff =
    parseFloat(document.getElementById("tariff-input").value) || 1444;
  const intervalHours = 5 / 60;
  const costThisInterval = (power / 1000) * intervalHours * tariff;
  const prevCost = costAccum.length > 0 ? costAccum[costAccum.length - 1] : 0;
  const now = new Date();
  const lbl =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");
  chartLabels.push(lbl);
  powerHistory.push(parseFloat(power.toFixed(2)));
  costAccum.push(parseFloat((prevCost + costThisInterval).toFixed(2)));
  if (chartLabels.length > MAX_HIST) {
    chartLabels.shift();
    powerHistory.shift();
    costAccum.shift();
  }
  if (costChart) {
    costChart.data.labels = [...chartLabels];
    costChart.data.datasets[0].data = [...powerHistory];
    costChart.data.datasets[1].data = [...costAccum];
    costChart.update("none");
  }
}

function updateCostCalc() {
  const tariff =
    parseFloat(document.getElementById("tariff-input").value) || 1444;
  const power = pzemData.power || 0;
  const avgPower =
    powerHistory.length > 0
      ? powerHistory.reduce((a, b) => a + b, 0) / powerHistory.length
      : power;
  const costPerHour = (avgPower / 1000) * tariff;
  const costPerDay = costPerHour * 24;
  const costPerMonth = costPerDay * 30;
  document.getElementById("cost-hour").textContent =
    "Rp " + Math.round(costPerHour).toLocaleString("id-ID");
  document.getElementById("cost-day").textContent =
    "Rp " + Math.round(costPerDay).toLocaleString("id-ID");
  document.getElementById("cost-month").textContent =
    "Rp " + Math.round(costPerMonth).toLocaleString("id-ID");
  document.getElementById("cost-avg-power").textContent =
    avgPower.toFixed(1) + " W";
}

function renderPzem(d) {
  const fmt = (id, v, dec) => {
    document.getElementById(id).textContent = v.toFixed(dec);
  };
  fmt("v-voltage", d.voltage, 1);
  fmt("v-current", d.current, 3);
  fmt("v-power", d.power, 1);
  fmt("v-energy", d.energy_kwh, 3);
  fmt("v-freq", d.frequency, 1);
  fmt("v-pf", d.power_factor, 2);
  const setStatus = (id, cls, text) => {
    const el = document.getElementById(id);
    el.className = "pzem-status " + cls;
    el.textContent = text;
  };
  if (d.voltage >= 207 && d.voltage <= 231)
    setStatus("s-voltage", "ok", "Normal");
  else if (d.voltage >= 195 && d.voltage <= 240)
    setStatus("s-voltage", "warn", "Tegangan Batas");
  else setStatus("s-voltage", "err", "Tegangan Abnormal");
  if (d.current <= 5) setStatus("s-current", "ok", "Aman");
  else if (d.current <= 8) setStatus("s-current", "warn", "Tinggi");
  else setStatus("s-current", "err", "Kelebihan Beban");
  if (d.power <= 1000) setStatus("s-power", "ok", "Efisien");
  else if (d.power <= 1500) setStatus("s-power", "warn", "Tinggi");
  else setStatus("s-power", "err", "Terlalu Tinggi");
  setStatus("s-energy", "ok", d.energy_kwh.toFixed(1) + " kWh");
  if (d.frequency >= 49.5 && d.frequency <= 50.5)
    setStatus("s-freq", "ok", "Stabil");
  else setStatus("s-freq", "warn", "Tidak Stabil");
  if (d.power_factor >= 0.95) setStatus("s-pf", "ok", "Baik");
  else if (d.power_factor >= 0.8) setStatus("s-pf", "warn", "Cukup");
  else setStatus("s-pf", "err", "Buruk");
}

function getDummySensor() {
  if (dummyTDSNaik) {
    dummyTDS += 8;
    if (dummyTDS >= TDS_MAX + 80) dummyTDSNaik = false;
  } else {
    dummyTDS -= 8;
    if (dummyTDS <= TDS_MIN - 80) dummyTDSNaik = true;
  }
  const t = Date.now() / 1000;
  return {
    sensor: {
      ph: 6.2 + Math.sin(t / 8) * 0.4,
      tds_ppm: dummyTDS,
      jarak_cm: 15 + Math.sin(t / 10) * 3,
      suhu_air_c: 24 + Math.sin(t / 15) * 1.5,
      cahaya_lux: 800 + Math.sin(t / 6) * 200,
      dht_suhu_c: 28 + Math.sin(t / 12) * 2.5,
      dht_humidity: 65 + Math.sin(t / 9) * 5,
    },
    relay: { ch1: relays[0], ch2: relays[1], ch3: relays[2], ch4: relays[3] },
  };
}

function getDummyPzem() {
  const t = Date.now() / 1000;
  return {
    voltage: 220 + Math.sin(t / 7) * 0.8,
    current: 1.2 + Math.sin(t / 5) * 0.4,
    power:
      220 * (1.2 + Math.sin(t / 5) * 0.4) * (0.93 + Math.sin(t / 11) * 0.03),
    energy_kwh: 0.3 + t / 36000,
    frequency: 50 + Math.sin(t / 3) * 0.1,
    power_factor: 0.94 + Math.sin(t / 9) * 0.03,
  };
}

function runAutoLogic(s) {
  if (mode !== "auto") return;
  relays[0] = true;
  const now = Date.now();
  if (!dummyDosing) {
    if (s.tds_ppm < TDS_MIN && s.tds_ppm > 0) {
      relays[1] = true;
      dummyDosing = true;
      dummyDosingStart = now;
    }
  } else {
    if (now - dummyDosingStart >= 5000 || s.tds_ppm >= TDS_MAX) {
      relays[1] = false;
      dummyDosing = false;
    }
  }
  if (s.dht_suhu_c > KIPAS_ON && !relays[2]) relays[2] = true;
  if (s.dht_suhu_c < KIPAS_OFF && relays[2]) relays[2] = false;
}

function renderSensor(s) {
  const set = (id, v, d) =>
    (document.getElementById(id).textContent = v.toFixed(d));
  set("v-ph", s.ph, 2);
  set("v-tds", s.tds_ppm, 0);
  set("v-jarak", s.jarak_cm, 1);
  set("v-suhu-air", s.suhu_air_c, 2);
  set("v-cahaya", s.cahaya_lux, 0);
  set("v-dht-suhu", s.dht_suhu_c, 2);
  set("v-dht-hum", s.dht_humidity, 2);
  [
    ["b-ph", (s.ph / 14) * 100],
    ["b-tds", Math.min((s.tds_ppm / 2000) * 100, 100)],
    ["b-jarak", Math.min((s.jarak_cm / 50) * 100, 100)],
    ["b-suhu-air", Math.min(((s.suhu_air_c - 10) / 40) * 100, 100)],
    ["b-cahaya", Math.min((s.cahaya_lux / 2000) * 100, 100)],
    ["b-dht-suhu", Math.min(((s.dht_suhu_c - 10) / 40) * 100, 100)],
    ["b-dht-hum", Math.min(s.dht_humidity, 100)],
  ].forEach(([id, w]) => {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, w).toFixed(1) + "%";
  });
}

function renderRelay() {
  relays.forEach((on, i) => {
    const n = i + 1;
    document.getElementById("icon-r" + n).className =
      "relay-icon " + (on ? "on" : "off");
    const badge = document.getElementById("badge-r" + n);
    badge.className = "relay-badge " + (on ? "on" : "off");
    badge.textContent = on ? "ON" : "OFF";
    document.getElementById("card-r" + n).className =
      "relay-card" + (on ? " relay-on" : "");
    document.getElementById("chk-r" + n).checked = on;
    document.getElementById("lbl-r" + n).className =
      "relay-toggle" + (mode === "auto" ? " disabled" : "");
  });
}

function renderAlerts(s) {
  const alerts = [];
  if (s.tds_ppm < TDS_MIN)
    alerts.push({
      type: "warn",
      msg: `TDS ${s.tds_ppm.toFixed(0)} ppm — di bawah minimum (${TDS_MIN} ppm), dosing nutrisi aktif`,
    });
  if (s.tds_ppm > TDS_MAX)
    alerts.push({
      type: "warn",
      msg: `TDS ${s.tds_ppm.toFixed(0)} ppm — di atas maksimum (${TDS_MAX} ppm)`,
    });
  if (s.dht_suhu_c > KIPAS_ON)
    alerts.push({
      type: "warn",
      msg: `Suhu udara ${s.dht_suhu_c.toFixed(1)}°C — kipas ventilasi menyala otomatis`,
    });
  if (s.ph < 5.5)
    alerts.push({
      type: "err",
      msg: `pH ${s.ph.toFixed(2)} — terlalu asam, periksa larutan nutrisi`,
    });
  if (s.ph > 7.0)
    alerts.push({
      type: "err",
      msg: `pH ${s.ph.toFixed(2)} — terlalu basa, sesuaikan pH larutan`,
    });
  if (!alerts.length)
    alerts.push({ type: "ok", msg: "Semua parameter dalam kondisi normal" });
  const icons = {
    warn: "alert-triangle",
    ok: "circle-check",
    err: "alert-circle",
  };
  document.getElementById("alert-area").innerHTML = alerts
    .map(
      (a) =>
        `<div class="alert ${a.type}"><i class="ti ti-${icons[a.type]}"></i> ${a.msg}</div>`,
    )
    .join("");
}

async function fetchFirebase() {
  try {
    const r = await fetch(`${FIREBASE_HOST}/.json?auth=${FIREBASE_AUTH}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error("[Firebase]", e);
    return null;
  }
}

async function fetchPzem() {
  try {
    const r = await fetch(
      `${FIREBASE_HOST}/pzem_data.json?auth=${FIREBASE_AUTH}`,
    );
    if (!r.ok) throw new Error();
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function pushMode() {
  if (DUMMY_MODE) return;
  try {
    await fetch(
      `${FIREBASE_HOST}/relay/mode_otomatis.json?auth=${FIREBASE_AUTH}`,
      { method: "PUT", body: mode === "auto" ? "true" : "false" },
    );
  } catch (e) {}
}

async function pushRelay(idx, val) {
  if (DUMMY_MODE) return;
  const keys = ["ch1", "ch2", "ch3", "ch4"];
  try {
    await fetch(
      `${FIREBASE_HOST}/relay/${keys[idx]}.json?auth=${FIREBASE_AUTH}`,
      { method: "PUT", body: val ? "true" : "false" },
    );
  } catch (e) {}
}

let chartTick = 0;
async function mainLoop() {
  let data, pzem;
  if (DUMMY_MODE) {
    data = getDummySensor();
    pzem = getDummyPzem();
  } else {
    const raw = await fetchFirebase();
    if (!raw || !raw.sensor) return;
    data = raw;
    if (raw.relay?.mode_otomatis !== undefined) {
      mode = raw.relay.mode_otomatis ? "auto" : "manual";
      updateModeUI();
    }
    if (mode === "manual" && raw.relay) {
      relays[0] = !!raw.relay.ch1;
      relays[1] = !!raw.relay.ch2;
      relays[2] = !!raw.relay.ch3;
      relays[3] = !!raw.relay.ch4;
    }
    const rawPzem = await fetchPzem();
    pzem = rawPzem || getDummyPzem();
  }
  const s = data.sensor;
  const prev = [...relays];
  runAutoLogic(s);
  if (mode === "auto")
    relays.forEach((v, i) => {
      if (v !== prev[i]) pushRelay(i, v);
    });
  renderSensor(s);
  renderRelay();
  renderAlerts(s);
  pzemData = pzem;
  renderPzem(pzem);
  chartTick++;
  if (chartTick % 5 === 0) updateChartData(pzem.power);
  updateCostCalc();
  lastRefreshTime = Date.now();
}

function updateClock() {
  const now = new Date(),
    pad = (n) => String(n).padStart(2, "0");
  document.getElementById("v-tanggal").textContent =
    `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  document.getElementById("v-waktu").textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  document.getElementById("v-refresh").textContent =
    `Refresh: ${((Date.now() - lastRefreshTime) / 1000).toFixed(1)}s lalu`;
}

function setMode(m) {
  mode = m;
  if (m === "auto") dummyDosing = false;
  if (m === "manual") {
    relays = [false, false, false, false];
    relays.forEach((v, i) => pushRelay(i, v));
  }
  updateModeUI();
  pushMode();
}

function updateModeUI() {
  document.getElementById("btn-auto").className =
    "mode-btn" + (mode === "auto" ? " active-auto" : "");
  document.getElementById("btn-manual").className =
    "mode-btn" + (mode === "manual" ? " active-manual" : "");
  document.getElementById("mode-info-text").innerHTML =
    mode === "auto"
      ? "Mode <b>Otomatis</b>: Relay dikendalikan sistem berdasarkan nilai sensor. Tombol relay dinonaktifkan."
      : "Mode <b>Manual</b>: Anda dapat menyalakan/mematikan setiap relay secara langsung.";
  renderRelay();
}

function toggleRelay(idx, val) {
  if (mode === "auto") return;
  relays[idx] = val;
  renderRelay();
  pushRelay(idx, val);
}

function switchTab(tab) {
  const isFruit = tab === "fruit";
  document.getElementById("panel-fruit").style.display = isFruit ? "" : "none";
  document.getElementById("panel-disease").style.display = !isFruit
    ? ""
    : "none";
  document.getElementById("tab-fruit").className =
    "ai-tab" + (isFruit ? " active-fruit" : "");
  document.getElementById("tab-disease").className =
    "ai-tab" + (!isFruit ? " active-disease" : "");
}

function handleDrag(e, tab) {
  e.preventDefault();
  document.getElementById("upload-" + tab).classList.add("dragover");
}
function handleDragLeave(e, tab) {
  document.getElementById("upload-" + tab).classList.remove("dragover");
}
function handleDrop(e, tab) {
  e.preventDefault();
  document.getElementById("upload-" + tab).classList.remove("dragover");
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) loadImage(f, tab);
}
function handleFile(e, tab) {
  const f = e.target.files[0];
  if (f) loadImage(f, tab);
}

// ✅ DIPERBAIKI: resize gambar ke max 640px sebelum kirim ke Roboflow
function loadImage(file, tab) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const originalDataURL = e.target.result;
    const img = new Image();
    img.onload = () => {
      // Resize ke max 640px (sama seperti yang Roboflow UI lakukan)
      const MAX = 640;
      let w = img.naturalWidth,
        h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w > h) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        } else {
          w = Math.round((w * MAX) / h);
          h = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];

      aiState[tab].file = file;
      aiState[tab].base64 = base64;

      // Preview tetap pakai gambar original
      const previewImg = document.getElementById("img-" + tab);
      previewImg.src = originalDataURL;
      previewImg.onload = () => {
        aiState[tab].naturalW = previewImg.naturalWidth;
        aiState[tab].naturalH = previewImg.naturalHeight;
      };
      aiState[tab].imgEl = previewImg;

      document.getElementById("upload-" + tab).style.display = "none";
      document.getElementById("preview-" + tab).style.display = "block";
      document.getElementById("btn-" + tab).disabled = false;
      document.getElementById("result-" + tab).innerHTML = "";
      clearCanvas(tab);
    };
    img.src = originalDataURL;
  };
  reader.readAsDataURL(file);
}

function clearImage(tab) {
  aiState[tab].file = null;
  aiState[tab].base64 = null;
  document.getElementById("img-" + tab).src = "";
  document.getElementById("upload-" + tab).style.display = "";
  document.getElementById("preview-" + tab).style.display = "none";
  document.getElementById("btn-" + tab).disabled = true;
  document.getElementById("result-" + tab).innerHTML = "";
  clearCanvas(tab);
  document
    .querySelectorAll("#upload-" + tab + " input[type=file]")
    .forEach((i) => (i.value = ""));
}

function clearCanvas(tab) {
  const c = document.getElementById("canvas-" + tab);
  c.getContext("2d").clearRect(0, 0, c.width, c.height);
}

function drawBoxes(tab, preds) {
  const img = document.getElementById("img-" + tab),
    canvas = document.getElementById("canvas-" + tab);
  const dW = img.clientWidth,
    dH = img.clientHeight;
  canvas.width = dW;
  canvas.height = dH;
  const nW = aiState[tab].naturalW || img.naturalWidth,
    nH = aiState[tab].naturalH || img.naturalHeight;
  const sx = dW / nW,
    sy = dH / nH,
    ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, dW, dH);
  const colors = [
    "#1D9E75",
    "#378ADD",
    "#D85A30",
    "#7F77DD",
    "#BA7517",
    "#D4537E",
  ];
  preds.forEach((p, idx) => {
    const color = colors[idx % colors.length];
    const x = (p.x - p.width / 2) * sx,
      y = (p.y - p.height / 2) * sy,
      w = p.width * sx,
      h = p.height * sy;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color + "cc";
    ctx.fillRect(x, y - 20, Math.min(w, 200), 20);
    ctx.fillStyle = "white";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(
      `${p.class} ${(p.confidence * 100).toFixed(0)}%`,
      x + 5,
      y - 5,
    );
  });
}

async function detect(tab) {
  const state = aiState[tab];
  if (!state.base64) return;
  const btn = document.getElementById("btn-" + tab),
    spin = document.getElementById("spin-" + tab),
    ico = document.getElementById("ico-" + tab),
    res = document.getElementById("result-" + tab);
  btn.disabled = true;
  spin.style.display = "block";
  ico.style.display = "none";
  res.innerHTML = "";
  const apiUrl = tab === "fruit" ? API_FRUIT : API_DISEASE;
  try {
    const response = await fetch(`${apiUrl}?api_key=${ROBOFLOW_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: state.base64,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Kedua model pakai format object detection (array dengan koordinat)
    let preds = data.predictions || [];
    preds.sort((a, b) => b.confidence - a.confidence);

    // Filter threshold setelah preds diisi
    const threshold =
      parseFloat(document.getElementById("thresh-" + tab).value) / 100;
    preds = preds.filter((p) => p.confidence >= threshold);

    if (preds.length > 0) setTimeout(() => drawBoxes(tab, preds), 100);
    else clearCanvas(tab);

    res.innerHTML = renderResult(tab, preds, data);
  } catch (e) {
    clearCanvas(tab);
    res.innerHTML = `<div class="error-box"><i class="ti ti-wifi-off"></i> Gagal menghubungi server Roboflow. Periksa koneksi internet atau API key.<br><small style="margin-top:4px;display:block;opacity:.7">${e.message}</small></div>`;
  }
  btn.disabled = false;
  spin.style.display = "none";
  ico.style.display = "";
}

function updateThreshLabel(tab) {
  const val = document.getElementById("thresh-" + tab).value;
  document.getElementById("thresh-val-" + tab).textContent = val + "%";
}

function confClass(c) {
  return c >= 0.75 ? "conf-high" : c >= 0.45 ? "conf-mid" : "conf-low";
}
function barColor(c) {
  return c >= 0.75 ? "#1D9E75" : c >= 0.45 ? "#BA7517" : "#E24B4A";
}

// =============================================
// DATABASE PENYAKIT DAUN MELON
// =============================================
const DISEASE_DB = {
  "powdery mildew": {
    nama: "Embun Tepung (Powdery Mildew)",
    penyebab:
      "Jamur Sphaerotheca fuliginea, dipicu kelembaban tinggi & sirkulasi udara buruk",
    bahaya: 3, // 1-5
    bahayaLabel: "Sedang-Tinggi",
    obatKimia: [
      {
        nama: "Fungisida Sulfur",
        dosis:
          "Semprotkan larutan 2–3 g/L setiap 7 hari. Efektif sebagai pencegah dan pengobatan awal.",
      },
      {
        nama: "Triadimenol / Hexaconazole",
        dosis:
          "Fungisida sistemik, semprotkan 1 mL/L air. Rotasi setiap 14 hari agar tidak resisten.",
      },
    ],
    obatOrganik:
      "Semprotkan larutan baking soda (1 sdt/1L air + 1 tetes sabun cuci). Alternatif: ekstrak bawang putih 10 mL/L air, semprotkan pagi hari.",
    langkah: [
      "Isolasi tanaman yang terinfeksi agar tidak menyebar ke tanaman sehat lainnya",
      "Potong dan buang daun yang terinfeksi parah, bakar atau kubur jauh dari area tanam",
      "Aktifkan kipas ventilasi — turunkan kelembaban ke 60–70%, pastikan sirkulasi udara baik",
      "Semprotkan fungisida merata ke seluruh permukaan daun (atas & bawah) pagi hari",
      "Monitor setiap 3 hari, ulangi penyemprotan jika gejala masih muncul setelah 7 hari",
    ],
    pencegahan:
      "Jaga kelembaban <70%, semprot fungisida preventif tiap 14 hari",
    warna: "amber",
  },
  "downy mildew": {
    nama: "Embun Bulu (Downy Mildew)",
    penyebab:
      "Oomycete Pseudoperonospora cubensis, menyebar lewat spora di udara lembab",
    bahaya: 4,
    bahayaLabel: "Tinggi",
    obatKimia: [
      {
        nama: "Metalaxyl + Mancozeb",
        dosis:
          "Campurkan 2 g/L air, semprotkan tiap 7 hari terutama pada musim hujan.",
      },
      {
        nama: "Propamocarb",
        dosis: "Fungisida sistemik, 2 mL/L air, efektif untuk Oomycete.",
      },
    ],
    obatOrganik:
      "Semprotkan tembaga hidroksida (copper hydroxide) organik 3 g/L air. Hindari penyiraman berlebihan pada daun.",
    langkah: [
      "Segera buang dan musnahkan daun bergejala (bercak kuning di atas, spora ungu di bawah daun)",
      "Hindari menyiram daun langsung — arahkan air ke media tanam/akar saja",
      "Tingkatkan jarak tanam antar tanaman untuk sirkulasi udara lebih baik",
      "Semprotkan fungisida sistemik pada pagi hari saat cuaca cerah",
      "Sterilkan alat potong dengan alkohol 70% setelah digunakan pada tanaman sakit",
      "Evaluasi kondisi 5–7 hari setelah pengobatan pertama",
    ],
    pencegahan:
      "Hindari kelembaban >80%, pilih varietas tahan penyakit, lakukan rotasi fungisida",
    warna: "red",
  },
  anthracnose: {
    nama: "Antraknosa (Anthracnose)",
    penyebab:
      "Jamur Colletotrichum orbiculare, aktif pada suhu 24–30°C dengan kelembaban tinggi",
    bahaya: 4,
    bahayaLabel: "Tinggi",
    obatKimia: [
      {
        nama: "Mankozeb 80 WP",
        dosis: "Campurkan 2 g/L air, semprotkan setiap 7–10 hari.",
      },
      {
        nama: "Azoxystrobin",
        dosis: "Fungisida sistemik, 0,5–1 mL/L air, rotasi tiap 14 hari.",
      },
    ],
    obatOrganik:
      "Gunakan trichoderma sp. (agen hayati) dicampurkan ke media tanam dan semprotkan larutan kunyit 10 g/L.",
    langkah: [
      "Buang dan musnahkan seluruh bagian tanaman yang terinfeksi (jangan kompos)",
      "Pastikan drainase media tanam baik, hindari genangan air",
      "Kurangi percikan air dari media ke daun saat penyiraman",
      "Semprotkan fungisida kontak secara merata tiap 7 hari",
      "Gunakan mulsa untuk mencegah cipratan spora dari tanah",
    ],
    pencegahan:
      "Sanitasi kebun rutin, hindari luka mekanis pada batang/buah, semprotkan preventif tiap 2 minggu",
    warna: "red",
  },
  "cercospora leaf spot": {
    nama: "Bercak Daun Cercospora",
    penyebab:
      "Jamur Cercospora citrullina, menyebar melalui percikan air dan angin",
    bahaya: 2,
    bahayaLabel: "Sedang",
    obatKimia: [
      {
        nama: "Mankozeb / Propineb",
        dosis: "Semprotkan 2 g/L air setiap 10–14 hari.",
      },
      {
        nama: "Klorotalonil",
        dosis: "Fungisida kontak, 2 mL/L air, efektif untuk pencegahan.",
      },
    ],
    obatOrganik:
      "Semprotkan larutan ekstrak mimba (neem oil) 5 mL/L air dicampur sedikit sabun cuci.",
    langkah: [
      "Buang daun tua dan terinfeksi yang berada di bagian bawah tanaman",
      "Pastikan jarak antar tanaman cukup untuk sirkulasi udara",
      "Semprotkan fungisida pada sore hari agar tidak cepat menguap",
      "Monitor perkembangan bercak setiap 5 hari sekali",
    ],
    pencegahan: "Sanitasi daun gugur, rotasi tanaman, hindari genangan",
    warna: "amber",
  },
  "fusarium wilt": {
    nama: "Layu Fusarium (Fusarium Wilt)",
    penyebab:
      "Jamur Fusarium oxysporum f.sp. melonis di dalam tanah, menyerang pembuluh xilem",
    bahaya: 5,
    bahayaLabel: "Sangat Tinggi",
    obatKimia: [
      {
        nama: "Benomyl / Carbendazim",
        dosis: "Siramkan larutan 2 g/L ke zona akar setiap 10 hari.",
      },
      {
        nama: "Thiophanate-methyl",
        dosis: "Fungisida sistemik, siramkan 1–2 g/L ke media tanam.",
      },
    ],
    obatOrganik:
      "Aplikasikan Trichoderma harzianum ke media tanam sebagai agen biokontrol. Campurkan 10 g/tanaman.",
    langkah: [
      "SEGERA cabut dan musnahkan tanaman yang sudah layu total — tidak bisa pulih",
      "Jangan gunakan kembali media tanam yang terkontaminasi tanpa sterilisasi",
      "Sterilisasi pot/wadah dengan larutan pemutih 10% sebelum digunakan ulang",
      "Periksa tanaman di sekitarnya, siram fungisida preventif ke zona akar",
      "Ganti ke varietas melon tahan fusarium untuk penanaman berikutnya",
    ],
    pencegahan:
      "Gunakan bibit bersertifikat, sterilisasi media tanam sebelum tanam, pH larutan nutrisi 5.5–6.5",
    warna: "red",
  },
  virus: {
    nama: "Penyakit Virus (Mosaik/Kuning)",
    penyebab:
      "Cucumber Mosaic Virus (CMV) atau Watermelon Mosaic Virus, ditularkan kutu daun (aphid)",
    bahaya: 4,
    bahayaLabel: "Tinggi",
    obatKimia: [
      {
        nama: "Insektisida Imidakloprid",
        dosis: "Basmi vektor kutu daun, 0.5 mL/L air, semprot tiap 7 hari.",
      },
    ],
    obatOrganik:
      "Semprotkan ekstrak bawang putih + cabai (10 g/L) untuk mengusir kutu daun sebagai vektor virus.",
    langkah: [
      "Tidak ada pengobatan langsung untuk virus — fokus pada pengendalian vektor (kutu daun)",
      "Cabut tanaman bergejala parah untuk mencegah penyebaran",
      "Semprotkan insektisida untuk membasmi kutu daun secara menyeluruh",
      "Pasang perangkap kuning (yellow sticky trap) di sekitar area tanam",
      "Cuci tangan dan sterilkan alat setelah menyentuh tanaman sakit",
    ],
    pencegahan:
      "Gunakan benih bebas virus, pasang kasa serangga di greenhouse, monitor populasi kutu daun",
    warna: "red",
  },
  "bacterial wilt": {
    nama: "Layu Bakteri (Bacterial Wilt)",
    penyebab:
      "Bakteri Erwinia tracheiphila, disebarkan oleh kumbang mentimun (cucumber beetle)",
    bahaya: 4,
    bahayaLabel: "Tinggi",
    obatKimia: [
      {
        nama: "Streptomycin Sulfate",
        dosis: "Semprotkan 1–2 g/L sebagai langkah awal, efektivitas terbatas.",
      },
      {
        nama: "Kasugamycin",
        dosis: "Bakterisida sistemik, 1 mL/L air, aplikasikan 2x seminggu.",
      },
    ],
    obatOrganik:
      "Semprotkan campuran tembaga oksiklorida 3 g/L. Basmi serangga vektor dengan insektisida organik pyrethrin.",
    langkah: [
      "Cabut tanaman yang sudah layu sepenuhnya dan segera musnahkan",
      "Semprotkan insektisida untuk mengendalikan kumbang mentimun sebagai vektor",
      "Periksa tanaman sekitarnya setiap hari selama 2 minggu ke depan",
      "Bersihkan dan sterilkan area tanam setelah mencabut tanaman sakit",
    ],
    pencegahan:
      "Pasang perangkap serangga, gunakan jaring pelindung, pilih varietas tahan layu bakteri",
    warna: "red",
  },
};

function getDiseaseInfo(className) {
  if (!className) return null;
  const lower = className.toLowerCase().trim();
  // Coba exact match dulu
  if (DISEASE_DB[lower]) return DISEASE_DB[lower];
  // Coba partial match
  for (const key of Object.keys(DISEASE_DB)) {
    if (lower.includes(key) || key.includes(lower)) return DISEASE_DB[key];
  }
  return null;
}

function renderResult(tab, preds, data) {
  if (!preds.length)
    return `<div class="result-area"><div class="no-result"><i class="ti ti-mood-empty" style="font-size:32px;color:var(--text3)"></i><span>Tidak ada objek terdeteksi. Coba dengan foto yang lebih jelas.</span></div></div>`;

  const top = preds.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  let summary = "",
    summaryClass = "";

  if (tab === "fruit") {
    const cls = (top.class || "").toLowerCase();
    if (cls.includes("matang") || cls.includes("ripe")) {
      summary = "🍈 Buah Matang";
      summaryClass = "matang";
    } else if (cls.includes("belum") || cls.includes("unripe")) {
      summary = "🟡 Belum Matang";
      summaryClass = "belum";
    } else {
      summary = "🍈 " + top.class;
      summaryClass = "tidak-diketahui";
    }
  } else {
    const cls = (top.class || "").toLowerCase();
    if (cls.includes("sehat") || cls.includes("healthy")) {
      summary = "✅ Daun Sehat";
      summaryClass = "sehat";
    } else {
      summary = "⚠️ " + top.class;
      summaryClass = "sakit";
    }
  }

  const sorted = [...preds].sort((a, b) => b.confidence - a.confidence);
  const rows = sorted
    .map(
      (p) =>
        `<div class="result-item">
      <div class="result-class">${p.class}</div>
      <div class="result-bar-wrap"><div class="result-bar"><div class="result-bar-fill" style="width:${(p.confidence * 100).toFixed(1)}%;background:${barColor(p.confidence)}"></div></div></div>
      <div class="result-conf ${confClass(p.confidence)}">${(p.confidence * 100).toFixed(1)}%</div>
    </div>`,
    )
    .join("");

  const imgInfo = data.image
    ? `<div style="font-size:11px;color:var(--text3);margin-top:8px">Resolusi: ${data.image.width}×${data.image.height}px &nbsp;|&nbsp; Objek terdeteksi: ${preds.length}</div>`
    : "";

  // ── SARAN PENGOBATAN (hanya tab disease & bukan healthy) ──
  let treatmentHTML = "";
  if (tab === "disease" && summaryClass === "sakit") {
    const info = getDiseaseInfo(top.class);
    if (info) {
      const dangerDots = Array.from(
        { length: 5 },
        (_, i) =>
          `<div style="width:10px;height:10px;border-radius:2px;background:${i < info.bahaya ? "#e24b4a" : "var(--border2)"}"></div>`,
      ).join("");

      const kimiaRows = info.obatKimia
        .map(
          (o) =>
            `<div class="treatment-item">
          <strong style="color:var(--amber-text)">${o.nama}</strong>
          <span style="color:var(--amber-text);opacity:0.85"> — ${o.dosis}</span>
        </div>`,
        )
        .join("");

      const langkahRows = info.langkah
        .map(
          (l, i) =>
            `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:6px">
          <div style="min-width:20px;height:20px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:white;flex-shrink:0;margin-top:1px">${i + 1}</div>
          <span style="font-size:12px;color:var(--amber-text);line-height:1.55">${l}</span>
        </div>`,
        )
        .join("");

      treatmentHTML = `
        <div class="treatment-card">
          <div class="treatment-header">
            <i class="ti ti-stethoscope" style="font-size:18px;color:var(--amber)"></i>
            <span class="treatment-title">Diagnosa &amp; Penanganan</span>
          </div>

          <div class="treatment-meta">
            <div class="treatment-meta-box">
              <div class="treatment-meta-label">Penyebab</div>
              <div class="treatment-meta-val">${info.penyebab}</div>
            </div>
            <div class="treatment-meta-box">
              <div class="treatment-meta-label">Tingkat Bahaya</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                <div style="display:flex;gap:3px">${dangerDots}</div>
                <span style="font-size:11px;color:var(--red-text);font-weight:500">${info.bahayaLabel}</span>
              </div>
            </div>
          </div>

          <div class="treatment-section">
            <div class="treatment-section-label"><i class="ti ti-pill" style="font-size:12px;margin-right:4px"></i>Pengobatan Kimia</div>
            ${kimiaRows}
          </div>

          <div class="treatment-section">
            <div class="treatment-section-label"><i class="ti ti-leaf" style="font-size:12px;margin-right:4px"></i>Alternatif Organik</div>
            <div class="treatment-item" style="font-style:normal">
              <span style="color:var(--amber-text);opacity:0.85">${info.obatOrganik}</span>
            </div>
          </div>

          <div class="treatment-section">
            <div class="treatment-section-label"><i class="ti ti-list-check" style="font-size:12px;margin-right:4px"></i>Langkah Penanganan</div>
            ${langkahRows}
          </div>

          <div class="treatment-prevention">
            <i class="ti ti-shield-check" style="font-size:15px;color:var(--green)"></i>
            <span><strong style="color:var(--green-text)">Pencegahan:</strong> <span style="color:var(--green-text);opacity:0.85">${info.pencegahan}</span></span>
          </div>
        </div>`;
    } else {
      // Penyakit terdeteksi tapi tidak ada di database
      treatmentHTML = `
        <div class="treatment-card">
          <div class="treatment-header">
            <i class="ti ti-stethoscope" style="font-size:18px;color:var(--amber)"></i>
            <span class="treatment-title">Penyakit Terdeteksi</span>
          </div>
          <p style="font-size:12.5px;color:var(--amber-text);line-height:1.6;margin:0">
            Penyakit <strong>${top.class}</strong> terdeteksi. Segera konsultasikan dengan ahli pertanian atau periksa literatur penyakit melon untuk penanganan lebih lanjut. Langkah awal: isolasi tanaman, potong bagian yang terinfeksi, dan perhatikan kelembaban lingkungan.
          </p>
          <div class="treatment-prevention" style="margin-top:12px">
            <i class="ti ti-alert-triangle" style="font-size:15px;color:var(--amber)"></i>
            <span style="color:var(--amber-text)">Jaga kondisi lingkungan optimal: kelembaban 60–70%, sirkulasi udara baik</span>
          </div>
        </div>`;
    }
  }

  return `<div class="result-area">
    <div class="result-box">
      <div style="margin-bottom:10px"><span class="summary-badge ${summaryClass}">${summary}</span></div>
      <div class="result-header">Semua Deteksi (${preds.length} objek)</div>
      ${rows}${imgInfo}
    </div>
    ${treatmentHTML}
  </div>`;
}

initChart();
mainLoop();
setInterval(mainLoop, 5000);
setInterval(updateClock, 500);
