import { describe, expect, it } from "vitest";

import { taskProgress } from "@/lib/task-progress";

describe("taskProgress", () => {
  it("完了した分と計測中の経過を足す", () => {
    const progress = taskProgress({
      finishedMinutes: 4,
      sessionSeconds: 16,
      estimateMinutes: null,
    });

    expect(progress.totalSeconds).toBe(256);
    expect(progress.totalMinutes).toBeCloseTo(4.267, 3);
  });

  // 分のまま足すと、計測中の秒が丸めで消えて時計が飛ぶ
  it("完了分に端数があっても計測中の秒が消えない", () => {
    const progress = taskProgress({
      finishedMinutes: 0.5,
      sessionSeconds: 1,
      estimateMinutes: null,
    });

    expect(progress.totalSeconds).toBe(31);
  });

  it("計測していなければ完了した分だけになる", () => {
    const progress = taskProgress({
      finishedMinutes: 10,
      sessionSeconds: 0,
      estimateMinutes: null,
    });

    expect(progress.totalSeconds).toBe(600);
  });

  describe("見積もりとの比較", () => {
    it("見積もりがなければ差もゲージも出さない", () => {
      const progress = taskProgress({
        finishedMinutes: 30,
        sessionSeconds: 0,
        estimateMinutes: null,
      });

      expect(progress.diffMinutes).toBeNull();
      expect(progress.isOverEstimate).toBe(false);
      expect(progress.gaugeRatio).toBeNull();
    });

    it("見積もり内なら超過扱いにしない", () => {
      const progress = taskProgress({
        finishedMinutes: 30,
        sessionSeconds: 0,
        estimateMinutes: 60,
      });

      expect(progress.diffMinutes).toBe(-30);
      expect(progress.isOverEstimate).toBe(false);
      expect(progress.gaugeRatio).toBe(0.5);
    });

    it("超えた分を正の差として返す", () => {
      const progress = taskProgress({
        finishedMinutes: 90,
        sessionSeconds: 0,
        estimateMinutes: 60,
      });

      expect(progress.diffMinutes).toBe(30);
      expect(progress.isOverEstimate).toBe(true);
    });

    it("ちょうど見積もりどおりは超過にしない", () => {
      const progress = taskProgress({
        finishedMinutes: 60,
        sessionSeconds: 0,
        estimateMinutes: 60,
      });

      expect(progress.diffMinutes).toBe(0);
      expect(progress.isOverEstimate).toBe(false);
    });

    // 超過分まで伸ばすとゲージが枠からはみ出すので、超過は色と数字で示す
    it("ゲージは1で頭打ちにする", () => {
      const progress = taskProgress({
        finishedMinutes: 180,
        sessionSeconds: 0,
        estimateMinutes: 60,
      });

      expect(progress.gaugeRatio).toBe(1);
    });

    // 見積もり0のタスクでゼロ除算にならないこと
    it("見積もり0はゲージを出さない", () => {
      const progress = taskProgress({
        finishedMinutes: 30,
        sessionSeconds: 0,
        estimateMinutes: 0,
      });

      expect(progress.gaugeRatio).toBeNull();
    });
  });
});
