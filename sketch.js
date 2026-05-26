let rainData = null;
let apiUrl = "https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D";
// 使用 corsproxy.io 作為公共代理伺服器，解決 127.0.0.1 的 CORS 限制問題
let proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(apiUrl);

// 台北市主要測站經緯度座標對照表 (用於精確地圖定位)
const stationCoords = {
  "湖田國小": { lat: 25.1528, lon: 121.5323 },
  "大屯國小": { lat: 25.1741, lon: 121.4925 },
  "桃源國中": { lat: 25.1397, lon: 121.4914 },
  "北投國小": { lat: 25.1321, lon: 121.5005 },
  "陽明高中": { lat: 25.0945, lon: 121.5148 },
  "太平國小": { lat: 25.0610, lon: 121.5111 },
  "民生國中": { lat: 25.0602, lon: 121.5606 },
  "中正國中": { lat: 25.0336, lon: 121.5201 },
  "三興國小": { lat: 25.0303, lon: 121.5583 },
  "格致國中": { lat: 25.1362, lon: 121.5387 },
  "平等國小": { lat: 25.1278, lon: 121.5714 },
  "至善國中": { lat: 25.1014, lon: 121.5489 },
  "碧湖國小": { lat: 25.0811, lon: 121.5878 },
  "東湖國小": { lat: 25.0689, lon: 121.6169 },
  "瑠公國中": { lat: 25.0372, lon: 121.5847 },
  "舊莊國小": { lat: 25.0402, lon: 121.6186 },
  "博嘉國小": { lat: 25.0000, lon: 121.5886 },
  "北政國中": { lat: 24.9861, lon: 121.5786 },
  "長安國小": { lat: 25.0489, lon: 121.5283 },
  "萬華國中": { lat: 25.0278, lon: 121.4986 },
  "台灣大學(新)": { lat: 25.0175, lon: 121.5397 },
  "雙園": { lat: 25.0232, lon: 121.4925 },
  "中洲": { lat: 25.1235, lon: 121.4608 }
};

// Mappa 地圖變數
let myMap;
let canvas;
const mappa = new Mappa('Leaflet');

// 地圖設定選項
const options = {
  lat: 25.03,
  lng: 121.56,
  zoom: 11,
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// 互動與特效變數
let sidebarHoveredName = null;
let raindrops = [];

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  // 初始化地圖並將其疊加在畫布下方
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas);

  textAlign(LEFT, TOP);
  textSize(14);
  
  // 取得資料
  fetchData();
  
  // 設定每 5 分鐘自動更新一次資料 (300,000 毫秒)
  setInterval(fetchData, 300000);

  // 初始化雨滴動畫
  for (let i = 0; i < 50; i++) {
    raindrops.push({ x: random(width - 150, width), y: random(0, 150), speed: random(2, 5) });
  }
}

function draw() {
  let hoveredStation = null;
  sidebarHoveredName = null; // 每一影格重置

  // 清除畫布，讓底層的地圖可以顯示出來
  clear();

  // 1. 繪製左側面板背景
  fill(30, 40, 60, 180); 
  noStroke();
  rect(0, 0, 300, height); 

  // 繪製圖例面板 (左下角)
  drawLegend();

  fill(255);
  
  if (!rainData) {
    text("正在從台北市政府 API 載入即時雨量資料...", 20, 20);
    return;
  }

  // 標題
  textSize(20);
  text("臺北市即時雨量資訊", 20, 20);
  textSize(12);
  // 檢查 rainData 是否有 'time' 屬性，或者使用當前時間
  let updateTime = rainData.time ? new Date(rainData.time).toLocaleString() : new Date().toLocaleString();
  text("更新時間: " + updateTime, 20, 50);
  
  stroke(255, 100);
  line(20, 70, 280, 70);
  noStroke();

  // 2. 處理資料與繪製 (增加多欄位顯示邏輯，確保所有站名都能顯示)
  let x = 20;
  let y = 85;
  let lineHeight = 20;
  let columnWidth = 140;
  let stations = rainData.data || [];
  let totalRain = 0;

  if (stations.length > 0) {
    // 計算整體雨量用於天氣特效
    stations.forEach(s => totalRain += (s.rain || 0));
    let avgRain = totalRain / stations.length;

    for (let i = 0; i < stations.length; i++) {
      let station = stations[i];
      let rainVal = station.rain || 0;
      
      // --- 繪製左側清單 ---
      if (y > height - 110) {
        y = 85;
        x += columnWidth;
      }

      if (x < 280) { // 限制在面板範圍內
        // 偵測滑鼠是否在該行文字上
        if (mouseX > 0 && mouseX < 300 && mouseY > y && mouseY < y + lineHeight) {
          sidebarHoveredName = station.stationName;
          fill(255, 255, 0); // 游標選中變黃色
        } else {
          fill(rainVal > 10 ? color(255, 100, 100) : 255);
        }
        textSize(13);
        text(`${station.stationName}: ${rainVal.toFixed(1)} mm`, x, y);
        y += lineHeight;
      }

      // --- 在地圖上繪製點位 ---
      if (station.lat && station.lon) {
        let pos = myMap.latLngToPixel(station.lat, station.lon);
        
        // 決定直徑：如果是面板選中或是地圖懸停，直徑變大
        let d = dist(mouseX, mouseY, pos.x, pos.y);
        let diameter = (station.stationName === sidebarHoveredName || d < 10) ? 30 : 10;
        
        if (d < 10) {
          hoveredStation = station;
        }

        // 填色邏輯：大於 10mm 紅色，其餘白色
        if (rainVal > 10) fill(255, 0, 0, 200);
        else fill(255, 255, 255, 200);
        
        stroke(0);
        strokeWeight(1);
        ellipse(pos.x, pos.y, diameter, diameter);
        noStroke();
      }
    }

    // 3. 繪製天氣特效 (右上角)
    drawWeatherEffect(avgRain);

    // 4. 繪製懸停資訊提示框 (Tooltip)
    if (hoveredStation) drawTooltip(hoveredStation);
    
  } else {
    fill(255, 100, 100);
    text("資料格式異常或無資料，無法解析內容。", 20, 100);
  }
}

function drawLegend() {
  let ly = height - 80;
  fill(0, 150);
  rect(10, ly, 280, 70, 5);
  fill(255);
  textSize(12);
  textAlign(LEFT, CENTER);
  text("雨量圖例說明：", 20, ly + 15);
  
  fill(255, 0, 0);
  ellipse(30, ly + 40, 10, 10);
  fill(255);
  text("大於 10 mm (強降雨)", 45, ly + 40);
  
  fill(255, 255, 255);
  ellipse(30, ly + 58, 10, 10);
  fill(255);
  text("小於等於 10 mm", 45, ly + 58);
}

function drawWeatherEffect(avgRain) {
  push();
  translate(width - 100, 70);
  if (avgRain < 0.5) {
    // 繪製大太陽
    fill(255, 200, 0);
    ellipse(0, 0, 60, 60);
    stroke(255, 200, 0);
    strokeWeight(4);
    for (let a = 0; a < TWO_PI; a += PI / 4) {
      let x1 = cos(a) * 40;
      let y1 = sin(a) * 40;
      let x2 = cos(a) * 55;
      let y2 = sin(a) * 55;
      line(x1, y1, x2, y2);
    }
  } else {
    // 繪製下雨效果
    fill(150, 150, 150);
    ellipse(0, -10, 80, 40);
    ellipse(20, 0, 60, 30);
    stroke(100, 200, 255);
    strokeWeight(2);
    raindrops.forEach(d => {
      line(d.x - (width - 100), d.y - 70, d.x - (width - 100) - 2, d.y - 70 + 10);
      d.y += d.speed;
      if (d.y > 150) d.y = 30;
    });
  }
  pop();
}

function drawTooltip(s) {
  let padding = 10;
  let txt = `測站: ${s.stationName}\n雨量: ${(s.rain || 0).toFixed(1)} mm\n座標: ${s.lat.toFixed(2)}, ${s.lon.toFixed(2)}`;
  
  let boxW = textWidth(txt) + padding * 2;
  let boxH = 60;
  
  fill(0, 200);
  noStroke();
  rect(mouseX + 15, mouseY, boxW, boxH, 5);
  fill(255);
  text(txt, mouseX + 15 + padding, mouseY + padding);
}

async function fetchData() {
  try {
    // 1. 取得台北市政府雨量資料
    const wicResponse = await fetch(proxyUrl);
    const wicRes = await wicResponse.json();
    let wicStations = Array.isArray(wicRes) ? wicRes : (wicRes.data || []);

    let merged = [];

    // 2. 使用手動座標表進行比對與整合
    // 遍歷我們想要顯示的測站列表
    for (let sName in stationCoords) {
      // 在 API 回傳的資料中尋找對應的雨量數據
      let wicMatch = wicStations.find(w => w.stationName.trim() === sName);
      let coords = stationCoords[sName];
      
      merged.push({
        stationName: sName,
        lat: coords.lat,
        lon: coords.lon,
        rain: wicMatch ? (wicMatch.rain || 0) : 0,
        time: wicMatch ? wicMatch.time : null
      });
    }

    rainData = { data: merged, time: new Date().toISOString() };
    console.log("已根據座標對照表更新台北市站點資料 (共 " + merged.length + " 站)");
  } catch (err) {
    console.error("資料更新失敗：", err);
    rainData = { error: "無法獲取即時雨量資料，請稍後再試。" };
  }
}

// 當視窗大小改變時，自動調整畫布
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
