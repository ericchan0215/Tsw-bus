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

  const mtr1 =
    document.getElementById("mtr1");

  const mtr2 =
    document.getElementById("mtr2");

  try {

    const url =
      `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${MTR_LINE}&sta=${MTR_STATION}&lang=tc`;

    const res =
      await fetch(url);

    const json =
      await res.json();

    if (!json.data) {

      mtr1.innerHTML = "--";

      mtr2.innerHTML =
        "MTR API 無資料";

      console.log(json);

      return;

    }

    const key =
      Object.keys(json.data)[0];

    const station =
      json.data[key];

    const up =
      station.UP || [];

    const down =
      station.DOWN || [];

    showMTR(
      "mtr1",
      up
    );

    showMTR(
      "mtr2",
      down
    );

  } catch (e) {

    console.log(e);

    mtr1.innerHTML = "--";

    mtr2.innerHTML = "--";

  }

}

function showMTR(id, arr) {

  const el =
    document.getElementById(id);

  if (!arr.length) {

    el.innerHTML = "--";

    return;

  }

  let html = "";

  arr
    .slice(0, 4)
    .forEach(train => {

      html +=
        etaColor(
          Number(train.ttnt)
        ) + " ";

    });

  el.innerHTML = html;

}

/* ===========================
   BUS
=========================== */

async function loadBus() {

  const bus =
    document.getElementById("bus");

  try {

    let all = [];

    for (const stop of BUS_STOP_IDS) {

      const res =
        await fetch(
          `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stop}`
        );

      const json =
        await res.json();

      if (json.data) {

        all.push(...json.data);

      }

    }

    if (!all.length) {

      bus.innerHTML =
        "沒有巴士資料";

      return;

    }

    all = all.filter(x => x.eta);

    all.sort((a, b) => {

      return (
        new Date(a.eta) -
        new Date(b.eta)
      );

    });

    const routes = {};

    for (const item of all) {

      const key =
        item.route +
        "_" +
        item.dest_tc;

      if (!routes[key]) {

        routes[key] = [];

      }

      if (
        routes[key].length < 2
      ) {

        routes[key].push(item);

      }

    }

    let html = "";

    Object.values(routes)
      .forEach(list => {

        const first = list[0];

        html += `

<div class="bus-item">

<div class="bus-route">
${first.route}
</div>

<div class="bus-dest">
往 ${first.dest_tc}
</div>

<div class="bus-eta">
${list
  .map(x =>
    etaColor(diff(x.eta))
  )
  .join("&nbsp;&nbsp;")}
</div>

</div>

`;

      });

    bus.innerHTML =
      html;

  } catch (e) {

    console.log(e);

    bus.innerHTML =
      "巴士 API 錯誤";

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
