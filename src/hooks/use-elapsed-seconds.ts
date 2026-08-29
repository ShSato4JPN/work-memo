"use client";

import { useEffect, useState } from "react";

/**
 * ある時刻からの経過秒数を1秒ごとに返す。計測中でなければ 0。
 *
 * 毎回 startedAt との差を計算し直すのが要点で、1秒ごとに +1 して溜め込まない。
 * 溜め込む作りだと、タブが非表示のあいだ setInterval が間引かれた分だけ
 * 時間が失われ、画面の時計と実際の記録が静かにずれていく。
 *
 * @param startedAtMs 計測開始時刻（ミリ秒）。計測していなければ null
 */
export function useElapsedSeconds(startedAtMs: number | null): number {
  const [seconds, setSeconds] = useState(() => elapsedSince(startedAtMs));

  useEffect(() => {
    if (startedAtMs === null) return;
    const tick = () => setSeconds(elapsedSince(startedAtMs));
    // 壁時計という外部システムとの同期。サーバ描画時の値をクライアントの現在時刻へ引き直す
    // oxlint-disable-next-line react/set-state-in-effect
    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [startedAtMs]);

  return startedAtMs === null ? 0 : seconds;
}

function elapsedSince(startedAtMs: number | null): number {
  if (startedAtMs === null) return 0;
  // 開始時刻が未来でも負の経過を出さない（時計のずれや手修正で起こりうる）
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}
