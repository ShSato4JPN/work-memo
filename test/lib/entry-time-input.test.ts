import { describe, expect, it } from "vitest";

import { parseEntryTimeInput } from "@/lib/entry-time-input";

describe("parseEntryTimeInput", () => {
  it("開始と終了が揃っていれば Date に変換する", () => {
    const result = parseEntryTimeInput({
      startValue: "2026-08-30T09:00",
      endValue: "2026-08-30T10:30",
      isRunning: false,
    });

    expect(result).toEqual({
      ok: true,
      startedAt: new Date(2026, 7, 30, 9, 0),
      endedAt: new Date(2026, 7, 30, 10, 30),
    });
  });

  // 計測中の記録を終わらせる手段は「停止」に一本化している
  it("計測中は終了時刻が空でも通り、終了は null になる", () => {
    const result = parseEntryTimeInput({
      startValue: "2026-08-30T09:00",
      endValue: "",
      isRunning: true,
    });

    expect(result).toEqual({
      ok: true,
      startedAt: new Date(2026, 7, 30, 9, 0),
      endedAt: null,
    });
  });

  it("開始が空なら理由を返す", () => {
    expect(
      parseEntryTimeInput({ startValue: "", endValue: "2026-08-30T10:00", isRunning: false }),
    ).toEqual({ ok: false, message: "開始時刻を入力してください" });
  });

  it("計測が終わっているのに終了が空なら理由を返す", () => {
    expect(
      parseEntryTimeInput({ startValue: "2026-08-30T09:00", endValue: "", isRunning: false }),
    ).toEqual({ ok: false, message: "終了時刻を入力してください" });
  });

  it("日時として読めない文字列は弾く", () => {
    expect(parseEntryTimeInput({ startValue: "あした", endValue: "", isRunning: true })).toEqual({
      ok: false,
      message: "開始時刻の形式が正しくありません",
    });

    expect(
      parseEntryTimeInput({
        startValue: "2026-08-30T09:00",
        endValue: "きのう",
        isRunning: false,
      }),
    ).toEqual({ ok: false, message: "終了時刻の形式が正しくありません" });
  });

  it("終了が開始より前なら弾く", () => {
    expect(
      parseEntryTimeInput({
        startValue: "2026-08-30T10:00",
        endValue: "2026-08-30T09:00",
        isRunning: false,
      }),
    ).toEqual({ ok: false, message: "終了時刻は開始時刻より後にしてください" });
  });

  // 開始と終了が同じ記録は「経過0分」で、あとから見ても何も読み取れない
  it("終了が開始と同じでも弾く", () => {
    expect(
      parseEntryTimeInput({
        startValue: "2026-08-30T09:00",
        endValue: "2026-08-30T09:00",
        isRunning: false,
      }),
    ).toEqual({ ok: false, message: "終了時刻は開始時刻より後にしてください" });
  });
});
