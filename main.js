const fs = require("fs");

function timeToSeconds(timeStr) {
  timeStr = timeStr.trim().toLowerCase();
  const parts = timeStr.split(" ");
  const timePart = parts[0];
  const period = parts[1];
  let [h, m, s] = timePart.split(":").map(Number);
  if (period === "am") {
    if (h === 12) h = 0;
  } else if (period === "pm") {
    if (h !== 12) h += 12;
  }
  return h * 3600 + m * 60 + s;
}

function secondsToHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function hmsToSeconds(hmsStr) {
  hmsStr = hmsStr.trim();
  const [h, m, s] = hmsStr.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

// Function 1
function getShiftDuration(startTime, endTime) {
  const startSec = timeToSeconds(startTime);
  const endSec = timeToSeconds(endTime);
  return secondsToHMS(endSec - startSec);
}

// Function 2
function getIdleTime(startTime, endTime) {
  const startSec = timeToSeconds(startTime);
  const endSec = timeToSeconds(endTime);
  const deliveryStart = 8 * 3600;
  const deliveryEnd = 22 * 3600;
  let idleSec = 0;
  if (startSec < deliveryStart) {
    const idleBefore = Math.min(deliveryStart, endSec) - startSec;
    if (idleBefore > 0) idleSec += idleBefore;
  }
  if (endSec > deliveryEnd) {
    const idleAfter = endSec - Math.max(deliveryEnd, startSec);
    if (idleAfter > 0) idleSec += idleAfter;
  }
  return secondsToHMS(idleSec);
}

// Function 3
function getActiveTime(shiftDuration, idleTime) {
  return secondsToHMS(hmsToSeconds(shiftDuration) - hmsToSeconds(idleTime));
}

// Function 4
function metQuota(date, activeTime) {
  const normalQuota = 8 * 3600 + 24 * 60;
  const eidQuota = 6 * 3600;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let quota = normalQuota;
  if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
    quota = eidQuota;
  }
  return hmsToSeconds(activeTime) >= quota;
}

// Function 5
function addShiftRecord(textFile, shiftObj) {
  const { driverID, driverName, date, startTime, endTime } = shiftObj;
  let content = "";
  try {
    content = fs.readFileSync(textFile, "utf8");
  } catch (e) {
    content = "";
  }
  const lines = content.split("\n").filter(line => line.trim() !== "");
  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID && cols[2].trim() === date) {
      return {};
    }
  }
  const shiftDuration = getShiftDuration(startTime, endTime);
  const idleTime = getIdleTime(startTime, endTime);
  const activeTime = getActiveTime(shiftDuration, idleTime);
  const quota = metQuota(date, activeTime);
  const hasBonus = false;
  const newRecord = {
    driverID,
    driverName,
    date,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    shiftDuration,
    idleTime,
    activeTime,
    metQuota: quota,
    hasBonus
  };
  const newLine = `${driverID},${driverName},${date},${startTime.trim()},${endTime.trim()},${shiftDuration},${idleTime},${activeTime},${quota},${hasBonus}`;
  let lastIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols[0].trim() === driverID) {
      lastIndex = i;
    }
  }
  if (lastIndex === -1) {
    lines.push(newLine);
  } else {
    lines.splice(lastIndex + 1, 0, newLine);
  }
  fs.writeFileSync(textFile, lines.join("\n") + "\n", "utf8");
  return newRecord;
}

// Function 6
function setBonus(textFile, driverID, date, newValue) {
  let content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n");
  const updatedLines = lines.map(line => {
    if (line.trim() === "") return line;
    const cols = line.split(",");
    if (cols[0].trim() === driverID && cols[2].trim() === date) {
      cols[9] = String(newValue);
      return cols.join(",");
    }
    return line;
  });
  fs.writeFileSync(textFile, updatedLines.join("\n"), "utf8");
}

// Function 7
function countBonusPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n").filter(line => line.trim() !== "");
  const targetMonth = parseInt(month, 10);
  let found = false;
  let count = 0;
  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      found = true;
      const recordMonth = parseInt(cols[2].trim().split("-")[1], 10);
      if (recordMonth === targetMonth) {
        if (cols[9].trim().toLowerCase() === "true") count++;
      }
    }
  }
  if (!found) return -1;
  return count;
}

// Function 8
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n").filter(line => line.trim() !== "");
  const targetMonth = parseInt(month, 10);
  let totalSeconds = 0;
  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      const recordMonth = parseInt(cols[2].trim().split("-")[1], 10);
      if (recordMonth === targetMonth) {
        totalSeconds += hmsToSeconds(cols[7].trim());
      }
    }
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Function 9
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
  const rateContent = fs.readFileSync(rateFile, "utf8");
  const rateLines = rateContent.split("\n").filter(l => l.trim() !== "");
  let dayOff = null;
  for (const line of rateLines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      dayOff = cols[1].trim().toLowerCase();
      break;
    }
  }
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n").filter(l => l.trim() !== "");
  const targetMonth = parseInt(month, 10);
  const normalQuota = 8 * 3600 + 24 * 60;
  const eidQuota = 6 * 3600;
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let totalRequired = 0;
  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      const dateStr = cols[2].trim();
      const recordMonth = parseInt(dateStr.split("-")[1], 10);
      if (recordMonth !== targetMonth) continue;
      const d = new Date(dateStr);
      const dayName = dayNames[d.getDay()];
      if (dayOff && dayName === dayOff) continue;
      const year = d.getFullYear();
      const day = d.getDate();
      let quota = normalQuota;
      if (year === 2025 && recordMonth === 4 && day >= 10 && day <= 30) {
        quota = eidQuota;
      }
      totalRequired += quota;
    }
  }
  totalRequired = Math.max(0, totalRequired - bonusCount * 2 * 3600);
  const h = Math.floor(totalRequired / 3600);
  const m = Math.floor((totalRequired % 3600) / 60);
  const s = totalRequired % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Function 10
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
  const rateContent = fs.readFileSync(rateFile, "utf8");
  const rateLines = rateContent.split("\n").filter(l => l.trim() !== "");
  let basePay = 0;
  let tier = 0;
  for (const line of rateLines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      basePay = parseInt(cols[2].trim(), 10);
      tier = parseInt(cols[3].trim(), 10);
      break;
    }
  }
  const allowedMissingHours = { 1: 50, 2: 20, 3: 10, 4: 3 };
  const allowed = (allowedMissingHours[tier] || 0) * 3600;
  const actualSec = hmsToSeconds(actualHours);
  const requiredSec = hmsToSeconds(requiredHours);
  if (actualSec >= requiredSec) return basePay;
  const missingSec = requiredSec - actualSec;
  if (missingSec <= allowed) return basePay;
  const billableHours = Math.floor((missingSec - allowed) / 3600);
  const deductionRatePerHour = Math.floor(basePay / 185);
  return basePay - billableHours * deductionRatePerHour;
}

module.exports = {
  getShiftDuration,
  getIdleTime,
  getActiveTime,
  metQuota,
  addShiftRecord,
  setBonus,
  countBonusPerMonth,
  getTotalActiveHoursPerMonth,
  getRequiredHoursPerMonth,
  getNetPay
};