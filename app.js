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
    // LOOP EACH STOP SEPARATELY
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
      // SORT BY ETA
      // =========================
      list.sort((a, b) =>
        new Date(a.eta) - new Date(b.eta)
      );

      // =========================
      // GROUP BY ROUTE + DEST
      // =========================
      const routes = {};

      for (const item of list) {

        const key = item.route + "_" + item.dest_tc;

        if (!routes[key]) routes[key] = [];

        if (routes[key].length < 2) {
          routes[key].push(item);
        }
      }

      // =========================
      // RENDER EACH ROUTE GROUP
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
