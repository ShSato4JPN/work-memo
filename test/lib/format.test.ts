import { describe, expect, it } from "vitest";
import { formatClock, formatClockLabel, formatDiff, formatDuration } from "@/lib/format";

describe("formatDuration", () => {
  it("60分未満は分だけで書く", () => {
    expect(formatDuration(0)).toBe("0分");
    expect(formatDuration(45)).toBe("45分");
  });

  // 「0分」と出しながら割合は100%、という読めない表示を作らないため
  it("経過しているのに四捨五入で0になる長さは「1分未満」と書く", () => {
    expect(formatDuration(0.2)).toBe("1分未満");
    expect(formatDuration(0.49)).toBe("1分未満");
  });

  it("ちょうど0は「0分」のまま", () => {
    expect(formatDuration(0)).toBe("0分");
  });

  it("30秒以上は1分に切り上がる", () => {
    expect(formatDuration(0.5)).toBe("1分");
  });

  it("ちょうど時間なら分を出さない", () => {
    expect(formatDuration(60)).toBe("1時間");
    expect(formatDuration(120)).toBe("2時間");
  });

  it("端数があれば時間と分で書く", () => {
    expect(formatDuration(90)).toBe("1時間30分");
    expect(formatDuration(61)).toBe("1時間1分");
  });

  it("秒の端数は四捨五入する", () => {
    expect(formatDuration(44.6)).toBe("45分");
    expect(formatDuration(59.7)).toBe("1時間");
  });
});

describe("formatClock", () => {
  it("分と秒は2桁に揃える", () => {
    expect(formatClock(0)).toBe("0:00:00");
    expect(formatClock(65)).toBe("0:01:05");
  });

  it("1時間を超えても桁が崩れない", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(45296)).toBe("12:34:56");
  });
});

// 「30分」だけだと超過なのか余りなのか読めないので、向きを必ず示す
describe("formatDiff", () => {
  it("超過には + を付ける", () => {
    expect(formatDiff(30)).toBe("+30分");
    expect(formatDiff(90)).toBe("+1時間30分");
  });

  it("余りには - を付ける", () => {
    expect(formatDiff(-15)).toBe("-15分");
    expect(formatDiff(-90)).toBe("-1時間30分");
  });

  it("ぴったりは ±0分", () => {
    expect(formatDiff(0)).toBe("±0分");
    expect(formatDiff(0.4)).toBe("±0分");
  });
});

describe("formatClockLabel", () => {
  it("0時からの経過分を時刻表記にする", () => {
    expect(formatClockLabel(0)).toBe("00:00");
    expect(formatClockLabel(570)).toBe("09:30");
    expect(formatClockLabel(1439)).toBe("23:59");
  });
});
