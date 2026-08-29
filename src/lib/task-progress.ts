/**
 * タスク1件の「いまどれだけ進んでいるか」の計算。
 *
 * 行の表示（時計・ゲージ・超過の色分け）がすべてこの結果から決まるので、
 * 描画から切り離して単体で確かめられるようにしている。
 */

export type TaskProgress = {
  /** 完了した分＋計測中の経過。秒単位（計測中の時計に使う） */
  totalSeconds: number;
  totalMinutes: number;
  /** 実績 − 見積もり（分、四捨五入）。見積もりがなければ null */
  diffMinutes: number | null;
  /** 見積もりを超えているか。見積もりがなければ false */
  isOverEstimate: boolean;
  /**
   * ゲージの伸び具合（0〜1）。1 で頭打ちにする。
   * 超過分まで伸ばすと枠からはみ出すので、超過は色と数字で示す。
   * 見積もりがない、または0のときは null（ゲージ自体を出さない）。
   */
  gaugeRatio: number | null;
};

export function taskProgress(input: {
  /** 終了済みの記録の合計（分）。計測中の分は含まない */
  finishedMinutes: number;
  /** いま計測中のセッションの経過（秒）。計測していなければ 0 */
  sessionSeconds: number;
  estimateMinutes: number | null;
}): TaskProgress {
  // 完了分は秒に直してから足す。分のまま足すと計測中の秒が丸めで消える
  const totalSeconds = Math.round(input.finishedMinutes * 60) + input.sessionSeconds;
  const totalMinutes = totalSeconds / 60;

  const estimate = input.estimateMinutes;
  const diffMinutes = estimate === null ? null : Math.round(totalMinutes - estimate);

  return {
    totalSeconds,
    totalMinutes,
    diffMinutes,
    isOverEstimate: diffMinutes !== null && diffMinutes > 0,
    gaugeRatio: estimate !== null && estimate > 0 ? Math.min(totalMinutes / estimate, 1) : null,
  };
}
