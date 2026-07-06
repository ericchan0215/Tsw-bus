const REFRESH = 15000;

init();

function init() {
  run();
  setInterval(run, REFRESH);
}

/* ===========================
   MAIN LOOP
=========================== */

async function run() {
  updateTime();
  await loadWeather();
  await loadMTR();
  await loadSchedule();
}

/* ===========================
   TIME
=========================== */

function updateTime() {
  document.getElementById("time").innerText =
    "最後更新（香港時間）：" +
    new Date().toLocaleString("zh-HK", {
      timeZone: "Asia/Hong_Kong"
    });
}

/* ===========================
   WEATHER
=========================== */

async function loadWeather() {
  try {
    const res = await fetch(
      "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc"
    );

    const json = await res.json();

    const temp = json.temperature.data[0].value;
    const humidity = json.humidity.data[0].value;

    document.getElementById("weather").innerHTML =
      `🌤️ ${temp}°C &nbsp;&nbsp;💧${humidity}%`;

  } catch (e) {
    console.log("WEATHER ERROR:", e);
  }
}

/* ===========================
   MTR
=========================== */

async function loadMTR() {

  const mtr1 = document.getElementById("mtr1");
  const mtr2 = document.getElementById("mtr2");

  try {

    const url =
      "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TML&sta=TIS&lang=tc";

    const res = await fetch(url);

    if (!res.ok) {
      mtr1.innerHTML = "--";
      mtr2.innerHTML = "HTTP error";
      return;
    }

    const json = await res.json();

    if (!json || json.status !== 1) {
      mtr1.innerHTML = "--";
      mtr2.innerHTML = "MTR error";
      return;
    }

    const firstKey = Object.keys(json.data)[0];
    const station = json.data[firstKey];

    renderMTR("mtr1", station.UP || []);
    renderMTR("mtr2", station.DOWN || []);

  } catch (e) {
    console.log("MTR ERROR:", e);
    mtr1.innerHTML = "--";
    mtr2.innerHTML = "fetch failed";
  }
}

function renderMTR(id, arr) {

  const el = document.getElementById(id);

  if (!arr || arr.length === 0) {
    el.innerHTML = "--";
    return;
  }

  let html = "";

  arr.slice(0, 4).forEach(train => {

    const t = train.ttnt;

    if (t === "ARRIVED") {
      html += "🔴 到站 ";
      return;
    }

    if (t === "END") {
      html += "⚫ 尾班 ";
      return;
    }

    const min = parseInt(t, 10);

    html += isNaN(min)
      ? "⚪ 即將 "
      : `🟢 ${min} 分鐘 `;
  });

  el.innerHTML = html;
}

/* ===========================
   GOOGLE SHEET (GViz FIXED)
=========================== */

async function getScheduleData() {

  try {

    const spreadsheetId =
      "1so1X1thdIXAqm2zBfPfxFQ6HjGo5a_RoMFeC_w6_hTY";

    const worksheetId = "1341569463";

    const url =
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${worksheetId}`;

    const response = await fetch(url);
    const text = await response.text();

    const jsonText = text
      .replace("/*O_o*/", "")
      .replace("google.visualization.Query.setResponse(", "")
      .slice(0, -2);

    const json = JSON.parse(jsonText);

    if (!json?.table?.rows) return [];

    return json.table.rows.map(row => {

      const rawDate = row.c?.[1]?.v;

      return {
        date: normalizeGVizDate(rawDate),
        rawDate,
        time: normalizeGVizTime(row.c?.[2]),
        person: row.c?.[3]?.v || "",
        activity: row.c?.[4]?.v || ""
      };
    });

  } catch (e) {
    console.log("SHEET ERROR:", e);
    return [];
  }
}

/* ===========================
   GViz DATE PARSER (CORE FIX)
=========================== */

function parseGVizDate(value) {

  if (!value) return null;

  const str = value.toString();

  // Case 1: Date(2026,6,6)
  const m = str.match(/Date\((\d+),(\d+),(\d+)/);

  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mo, d);
  }

  // fallback
  const fallback = new Date(str);
  return isNaN(fallback) ? null : fallback;
}

/* ===========================
   NORMALIZE DATE (SAFE OUTPUT)
=========================== */

function normalizeGVizDate(value) {

  const d = parseGVizDate(value);

  if (!d) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd}`;
}

/* ===========================
   NORMALIZE TIME (optional)
=========================== */

function normalizeGVizTime(cell) {

  if (!cell) return "";

  return cell.f || cell.v || "";
}

/* ===========================
   SCHEDULE
=========================== */

async function loadSchedule() {

  const data = await getScheduleData();

  console.log("🔥 SCHEDULE DATA:", data);

  const todayEvents = getTodayEvents(data);
  const weekEvents = getWeekEvents(data);

  renderSchedule(todayEvents, "todayEvents");
  renderSchedule(weekEvents, "weekEvents");
}

/* ===========================
   FILTER (FULL SAFE)
=========================== */

function getTodayEvents(data) {

  const now = new Date();

  const todayKey =
    `${now.getFullYear()}/` +
    `${String(now.getMonth() + 1).padStart(2, "0")}/` +
    `${String(now.getDate()).padStart(2, "0")}`;

  return data.filter(e => e.date === todayKey);
}

function getWeekEvents(data) {

  const now = new Date();
  now.setHours(0,0,0,0);

  const end = new Date();
  end.setDate(now.getDate() + 7);
  end.setHours(23,59,59,999);

  return data.filter(e => {

    const d = parseGVizDate(e.rawDate);
    if (!d) return false;

    return d >= now && d <= end;
  });
}

/* ===========================
   RENDER
=========================== */

function renderSchedule(events, id) {

  const el = document.getElementById(id);

  if (!events || events.length === 0) {
    el.innerHTML = "暫無行程";
    return;
  }

  el.innerHTML = events.map(e => `
    <div class="schedule-item">
      <div class="schedule-time">🕒 ${e.time}</div>
      <div class="schedule-person">👤 ${e.person}</div>
      <div class="schedule-title">📌 ${e.activity}</div>
    </div>
  `).join("");
}

console.log("TODAY KEY:", getTodayKey());
console.log("SHEET DATES:", data.map(d => d.date));
