"use client";

import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { stopTimer } from "@/server/actions/timer";
import type { TimerBarView } from "@/server/queries/timer-bar";

const WARN_AFTER_MIN = 120;

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

/**
 * 全画面に常駐する計測バー。このアプリの「機械」にあたる部分。
 *
 * 経過時間はクライアントに保持せず、毎ティック startedAt からの差分を計算し直す。
 * リロードやスリープ復帰でズレないのはこのため。
 */
export function TimerBar({ view }: { view: TimerBarView }) {
  const running = view.running;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    running ? Math.max(0, Math.floor((Date.now() - running.startedAt.getTime()) / 1000)) : 0,
  );

  // running がオブジェクトなので、依存には同一性の安定した値を使う。
  // そうしないと再レンダーのたびに interval が張り直される。
  const startedAtMs = running?.startedAt.getTime() ?? null;

  useEffect(() => {
    // 計測していないときの elapsedSeconds は描画に使わないので、書き戻さない
    if (startedAtMs === null) return;
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    // 壁時計という外部システムとの同期。SSR 時の値を即座にクライアントの現在時刻へ引き直す
    // oxlint-disable-next-line react/set-state-in-effect
    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [startedAtMs]);

  const clock = formatClock(elapsedSeconds);

  useEffect(() => {
    document.title = running ? `${clock} ${running.title}` : "作業時間トラッカー";
  }, [clock, running]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const elapsedMin = elapsedSeconds / 60;
  const totalMin = running ? running.priorMinutes + elapsedMin : 0;
  const estimate = running?.estimateMin ?? null;
  const ratio = estimate && estimate > 0 ? totalMin / estimate : null;
  const overEstimate = ratio !== null && ratio > 1;
  const tooLong = elapsedMin > WARN_AFTER_MIN;

  return (
    <>
      <div className="border-border bg-card sticky top-0 z-40 border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
          {running ? (
            <>
              <span
                aria-hidden
                className="h-9 w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: running.categoryColor }}
              />

              <span className="flex shrink-0 items-center gap-2">
                <span
                  aria-hidden
                  className="bg-live size-2 rounded-full motion-safe:animate-pulse"
                />
                <span className="text-live sr-only font-mono text-[10px] tracking-widest uppercase not-sr-only sm:inline">
                  rec
                </span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{running.title}</span>
                <span className="text-muted-foreground block font-mono text-[11px]">
                  {running.categoryName}
                  {estimate !== null && (
                    <>
                      {" · "}見積 {estimate}分 / 実績 {Math.round(totalMin)}分
                      {overEstimate && (
                        <span className="text-live"> +{Math.round(totalMin - estimate)}分</span>
                      )}
                    </>
                  )}
                  {tooLong && <span className="text-live"> · 停止し忘れていませんか</span>}
                </span>
              </span>

              <span
                className={`shrink-0 font-mono text-[26px] leading-none tracking-tight tabular-nums sm:text-[32px] ${
                  overEstimate ? "text-live" : ""
                }`}
                suppressHydrationWarning
              >
                {clock}
              </span>

              <form action={stopTimer} className="shrink-0">
                <button
                  type="submit"
                  className="border-live text-live hover:bg-live focus-visible:ring-live rounded-xs border px-4 py-2 text-[13px] font-medium transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none"
                >
                  停止
                </button>
              </form>
            </>
          ) : (
            <>
              <span aria-hidden className="bg-rule-strong h-9 w-[3px] shrink-0 rounded-full" />
              <span className="text-muted-foreground flex-1 text-[14px]">計測していません</span>
              <button
                type="button"
                onClick={openPalette}
                className="border-primary text-primary hover:bg-primary focus-visible:ring-primary flex shrink-0 items-center gap-2 rounded-xs border px-4 py-2 text-[13px] font-medium transition-colors hover:text-white focus-visible:ring-2 focus-visible:outline-none"
              >
                作業を開始
                <kbd className="font-mono text-[10px] opacity-70">⌘K</kbd>
              </button>
            </>
          )}
        </div>

        {/* シグネチャ: 見積もりに対する現在地。作業中ずっと伸び続け、超えると赤に転じる */}
        {running && (
          <div
            className="bg-gauge-track h-[3px] w-full"
            role="progressbar"
            aria-label="見積もりに対する実績"
            aria-valuemin={0}
            aria-valuemax={estimate ?? undefined}
            aria-valuenow={Math.round(totalMin)}
            aria-valuetext={
              estimate === null
                ? `実績 ${Math.round(totalMin)}分（見積もりなし）`
                : `見積 ${estimate}分に対して実績 ${Math.round(totalMin)}分`
            }
          >
            {ratio !== null && (
              <div
                className={`h-full transition-[width] duration-1000 ease-linear ${
                  overEstimate ? "bg-live" : "bg-primary"
                }`}
                style={{ width: `${Math.min(ratio, 1) * 100}%` }}
              />
            )}
          </div>
        )}
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          tasks={view.tasks}
          categories={view.categories}
          runningTaskId={running?.taskId ?? null}
        />
      )}
    </>
  );
}
