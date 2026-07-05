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

    if (isNaN(min)) {
      html += "⚪ 即將 ";
    } else {
      html += `🟢 ${min} 分鐘 `;
    }

  });

  el.innerHTML = html;
}

/* ===========================
   GOOGLE SHEET
=========================== */

async function getScheduleData() {

  const spreadsheetId =
    "1so1X1thdIXAqm2zBfPfxFQ6HjGo5a_RoMFeC_w6_hTY";

  const worksheetId = "1341569463";

  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${worksheetId}`;

  const response = await fetch(url);
  const text = await response.text();

  const json =
    JSON.parse(text.substring(47).slice(0, -2));

  return json.table.rows.map(row => ({
    date: parseDate(row.c[1]?.v),
    time: row.c[2]?.v || "",
    person: row.c[3]?.v || "",
    activity: row.c[4]?.v || ""
  }));
}

/* ===========================
   SCHEDULE MAIN
=========================== */

async function loadSchedule() {

  const data = await getScheduleData();

  const todayEvents = getTodayEvents(data);
  const weekEvents = getWeekEvents(data);

  renderSchedule(todayEvents, "todayEvents");
  renderSchedule(weekEvents, "weekEvents");
}

/* ===========================
   FILTERS
=========================== */

function getTodayEvents(data) {

  const today = formatDate(new Date());

  return data.filter(e => e.date === today);
}

function getWeekEvents(data) {

  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);

  return data.filter(e => {
    const d = new Date(e.date);
    return d > today && d <= end;
  });
}

/* ===========================
   RENDER
=========================== */

function renderSchedule(events, id) {

  const el = document.getElementById(id);

  if (!events.length) {
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

/* ===========================
   DATE HELPERS
=========================== */

function parseDate(str) {

  if (!str) return "";

  const d = new Date(str);

  if (isNaN(d.getTime())) return str;

  return formatDate(d);
}

function formatDate(d) {

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
}
