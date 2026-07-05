const REFRESH = 15000;

const BUS_STOP_IDS = [
  "378A33FE9A4089DF", // 聚星樓 TN200
  "A12E1F37C7D98567"  // 天祐苑 TN592
];

const MTR_LINE = "TML";
const MTR_STATION = "TIS";

init();

function init() {
  run();
  setInterval(run, REFRESH);
}

async function run() {
  updateTime();
  await loadWeather();
  await loadMTR();
  await loadBus();
  await loadMTRBusData();
}

/* ===========================
   香港時間
=========================== */

function updateTime() {

  document.getElementById("time").innerText =
    "最後更新（香港時間）：" +
    new Date().toLocaleString("zh-HK", {
      timeZone: "Asia/Hong_Kong"
    });

}

/* ===========================
   天氣
=========================== */

async function loadWeather() {

  try {

    const res = await fetch(
      "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc"
    );

    const json = await res.json();

    const temp =
      json.temperature.data[0].value;

    const humidity =
      json.humidity.data[0].value;

    document.getElementById("weather").innerHTML =
      `🌤️ ${temp}°C &nbsp;&nbsp;💧${humidity}%`;

  } catch (e) {

    console.log(e);

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

    // 🔥 step 1: check HTTP ok
    if (!res.ok) {
      console.log("HTTP FAIL:", res.status);
      mtr1.innerHTML = "--";
      mtr2.innerHTML = "HTTP error";
      return;
    }

    const json = await res.json();

    console.log("🔥 FULL MTR RESPONSE:", json);

    // 🔥 step 2: force inspect
    if (!json) {
      mtr1.innerHTML = "--";
      mtr2.innerHTML = "empty response";
      return;
    }

    console.log("status:", json.status);
    console.log("data keys:", json.data ? Object.keys(json.data) : null);

    // 🔥 step 3: status check (robust)
    if (String(json.status) !== "1") {
      mtr1.innerHTML = "--";
      mtr2.innerHTML = "MTR status not OK";
      return;
    }

    if (!json.data || Object.keys(json.data).length === 0) {
      mtr1.innerHTML = "--";
      mtr2.innerHTML = "no train data";
      return;
    }

    // 🔥 step 4: extract station
    const firstKey = Object.keys(json.data)[0];
    const station = json.data[firstKey];

    console.log("station key:", firstKey);
    console.log("station:", station);

    if (!station) {
      mtr1.innerHTML = "--";
      mtr2.innerHTML = "station undefined";
      return;
    }

    // 🔥 step 5: render
    renderMTR("mtr1", station.UP || []);
    renderMTR("mtr2", station.DOWN || []);

  } catch (e) {

    console.log("🔥 MTR FETCH ERROR:", e);

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

    // =========================
    // handle special cases
    // =========================
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
      html += etaColor(min) + " ";
    }

  });

  el.innerHTML = html;
}

/* ===========================
   BUS
=========================== */

async function loadBus() {

  const bus = document.getElementById("bus");

  try {

    const stops = {
      "378A33FE9A4089DF": "📍 聚星樓",
      "A12E1F37C7D98567": "📍 天祐苑"
    };

    let html = "";

    // =========================
    // LOOP EACH STOP
    // =========================
    for (const stopId of Object.keys(stops)) {

      const res = await fetch(
        `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stopId}`
      );

      const json = await res.json();

      const list = (json.data || []).filter(x => x.eta);

      html += `<div class="stop-block">`;
      html += `<h3>${stops[stopId]}</h3>`;

      if (!list.length) {
        html += "no bus data";
        html += `</div>`;
        continue;
      }

      // =========================
      // SORT ETA
      // =========================
      list.sort((a, b) =>
        new Date(a.eta) - new Date(b.eta)
      );

      // =========================
      // 🔥 FIX: TRUE DEDUP + GROUPING
      // =========================
      const routes = {};
      const seen = new Set();

      for (const item of list) {

        // 🔥 REAL UNIQUE KEY (KMB duplicate-safe)
        const uniqueKey =
          item.route + "|" +
          item.dest_tc + "|" +
          item.eta;

        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        const groupKey =
          item.route + "_" + item.dest_tc;

        if (!routes[groupKey]) {
          routes[groupKey] = [];
        }

        if (routes[groupKey].length < 2) {
          routes[groupKey].push(item);
        }
      }

      // =========================
      // RENDER
      // =========================
      for (const group of Object.values(routes)) {

        const first = group[0];

        html += `
          <div class="bus-item">
            <div class="bus-route">${first.route}</div>
            <div class="bus-dest">往 ${first.dest_tc}</div>
            <div class="bus-eta">
              ${group
                .map(x => etaColor(diff(x.eta)))
                .join("&nbsp;&nbsp;")}
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    bus.innerHTML = html;

  } catch (e) {

    console.log("BUS ERROR:", e);
    bus.innerHTML = "巴士 API 錯誤";
  }
}

/* ===========================
   HELPERS
=========================== */

function diff(time) {

  const target =
    new Date(time).getTime();

  const now =
    Date.now();

  return Math.round(
    (target - now) / 60000
  );

}

function etaColor(min) {

  if (min <= 1) {

    return "🔴 即將";

  }

  if (min <= 5) {

    return "🟢 " + min + " 分鐘";

  }

  return "⚪ " + min + " 分鐘";

}

async function loadMTRBusData() {

  const el = document.getElementById("mtrbus");

  try {

    const routes = ["K51", "K53", "K51A"];

    let html = "";

    for (const route of routes) {

      const url =
        "https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule"
        + "?language=zh"
        + "&routeName=" + encodeURIComponent(route);

      const res = await fetch(url);
      const json = await res.json();

      console.log("MTR BUS RAW:", json);

      // 🚨 STEP 1: status check
      if (!json || json.status !== "1") {
        html += `
          <div class="bus-item">
            <div class="bus-route">🚍 ${route}</div>
            <div class="bus-eta">service unavailable</div>
          </div>
        `;
        continue;
      }

      // 🚨 STEP 2: busStop check
      if (!json.busStop || !Array.isArray(json.busStop)) {
        html += `
          <div class="bus-item">
            <div class="bus-route">🚍 ${route}</div>
            <div class="bus-eta">no stops</div>
          </div>
        `;
        continue;
      }

      let buses = [];

      // 🚨 STEP 3: flatten busStop → bus[]
      json.busStop.forEach(stop => {

        if (stop.bus && Array.isArray(stop.bus)) {
          buses.push(...stop.bus);
        }

      });

      if (buses.length === 0) {
        html += `
          <div class="bus-item">
            <div class="bus-route">🚍 ${route}</div>
            <div class="bus-eta">no buses</div>
          </div>
        `;
        continue;
      }

      // 🚨 STEP 4: sort by ETA
      buses.sort((a, b) =>
        Number(a.arrivalTimeInSecond) -
        Number(b.arrivalTimeInSecond)
      );

      const top = buses.slice(0, 2);

      html += `
        <div class="bus-item">
          <div class="bus-route">🚍 ${route}</div>
          <div class="bus-eta">
            ${top.map(b =>
              formatMTRBusETA(b.arrivalTimeText)
            ).join("&nbsp;&nbsp;")}
          </div>
        </div>
      `;
    }

    el.innerHTML = html || "no MTR bus data";

  } catch (e) {
    console.log("MTR BUS ERROR:", e);
    el.innerHTML = "MTR Bus API error";
  }
}

function formatMTRBusETA(text) {

  if (!text) return "--";

  if (
    text.includes("Arriving") ||
    text.includes("即將到站")
  ) {
    return "🔴 即將";
  }

  if (
    text.includes("Departed") ||
    text.includes("已離開")
  ) {
    return "⚪ 已開出";
  }

  if (text.includes("minutes") || text.includes("分鐘")) {
    return "🟢 " + text;
  }

  return text;
}

async function loadMTRBus(route) {

  try {

    const url =
      `https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule?language=zh&routeName=${route}`;

    const res = await fetch(url);
    const json = await res.json();

    return json.data?.[route] || null;

  } catch (e) {
    console.log("MTR BUS ERROR", e);
    return null;
  }
}

function renderMTRBus(routeData) {

  if (!routeData) return "--";

  const up = routeData.UP || [];
  const down = routeData.DOWN || [];

  return {
    up,
    down
  };
}

async function getScheduleData() {
    const spreadsheetId = "1so1X1thdIXAqm2zBfPfxFQ6HjGo5a_RoMFeC_w6_hTY";
    const worksheetId = "1341569463";

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${worksheetId}`;

    const response = await fetch(url);
    const responseText = await response.text();

    // Remove the Google Visualization wrapper
    const json = JSON.parse(responseText.substring(47).slice(0, -2));

    return json.table.rows.map(row => ({
        date: row.c[1]?.f || row.c[1]?.v,
        time: row.c[2]?.f || row.c[2]?.v,
        person: row.c[3]?.v || "",
        activity: row.c[4]?.v || ""
    }));
}

// Test
getScheduleData()
    .then(schedule => {
        console.log("Schedule:", schedule);
    })
    .catch(error => {
        console.error(error);
    });
