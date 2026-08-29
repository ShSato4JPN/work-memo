"use client";

import { useEffect, useState } from "react";

/**
 * 一定間隔で進む「いまの時刻」。
 *
 * サーバで描画した時刻をそのまま使い続けると、画面を開いたままのときに
 * 現在線も計測中のバーも止まってしまう。初期値にはサーバの値を使い（そうしないと
 * 描画結果がサーバとクライアントで食い違う）、マウント後にクライアントの時計へ引き継ぐ。
 *
 * @param intervalMs 更新の間隔。秒を表示しないなら短くしても意味がない
 * @param initialNow サーバ描画時の時刻
 */
export function useNow(intervalMs: number, initialNow: Date): Date {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const tick = () => setNow(new Date());
    // 壁時計という外部システムとの同期。サーバ描画時の値をクライアントの現在時刻へ引き直す
    // oxlint-disable-next-line react/set-state-in-effect
    tick();
    const timerId = setInterval(tick, intervalMs);
    return () => clearInterval(timerId);
  }, [intervalMs]);

  return now;
}
