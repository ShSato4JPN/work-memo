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
  const mmss = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return `${hours}:${mmss}`;
}

/**
 * 全画面に常駐する計測バー。
 *
 * 大きな時計はそのタスクの「通算」を表示する。止めて再開したときに 0 に戻らず、
 * 続きから進むように見えるのが狙い。記録自体は 1 回ごとに別エントリのまま。
 *
 * 経過はクライアントに溜め込まず、毎ティック startedAt からの差分を計算し直す。
 * リロードやスリープ復帰でズレないのはこのため。
 */
export function TimerBar({ view }: { view: TimerBarView }) {
  const running = view.running;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(() =>
    running ? Math.max(0, Math.floor((Date.now() - running.startedAt.getTime()) / 1000)) : 0,
  );

  const startedAtMs = running?.startedAt.getTime() ?? null;

  useEffect(() => {
    if (startedAtMs === null) return;
    const tick = () =>
      setSessionSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    // 壁時計という外部システムとの同期。SSR 時の値を即座にクライアントの現在時刻へ引き直す
    // oxlint-disable-next-line react/set-state-in-effect
    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [startedAtMs]);

  // 画面に出す時計は「これまでの合計 + いまのセッション」
  const priorSeconds = running ? Math.round(running.priorMinutes * 60) : 0;
  const totalSeconds = priorSeconds + sessionSeconds;
  const clock = formatClock(totalSeconds);

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

  const totalMin = totalSeconds / 60;
  const estimate = running?.estimateMin ?? null;
  const ratio = estimate && estimate > 0 ? totalMin / estimate : null;
  const overEstimate = ratio !== null && ratio > 1;
  const sessionTooLong = sessionSeconds / 60 > WARN_AFTER_MIN;

  return (
    <>
      <div className="bg-background sticky top-0 z-40 px-4 pt-4 pb-1">
        <div className="mx-auto max-w-4xl">
          {running ? (
            <div className="bg-card rounded-3xl p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: running.categoryColor }}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{running.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {running.categoryName}
                    {sessionTooLong && (
                      <span className="text-live font-medium">{" · "}停止し忘れていませんか？</span>
                    )}
                  </p>
                </div>

                <p
                  className={`shrink-0 text-4xl leading-none font-extrabold tabular-nums sm:text-5xl ${
                    overEstimate ? "text-live" : ""
                  }`}
                  suppressHydrationWarning
                  aria-label={`これまでの合計 ${clock}`}
                >
                  {clock}
                </p>

                <form action={stopTimer} className="shrink-0">
                  <button
                    type="submit"
                    className="bg-live focus-visible:ring-live inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none active:scale-[0.98]"
                  >
                    <span aria-hidden className="size-3 rounded-[3px] bg-white" />
                    停止
                  </button>
                </form>
              </div>

              {/* 見積もりに対して今どこまで来ているか。超えると色が変わる */}
              <div className="mt-4 flex items-center gap-3">
                <div
                  className="bg-gauge-track h-2.5 flex-1 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label="見積もりに対する合計時間"
                  aria-valuemin={0}
                  aria-valuemax={estimate ?? undefined}
                  aria-valuenow={Math.round(totalMin)}
                  aria-valuetext={
                    estimate === null
                      ? `合計 ${Math.round(totalMin)}分（見積もりなし）`
                      : `見積もり ${estimate}分のうち ${Math.round(totalMin)}分`
                  }
                >
                  {ratio !== null && (
                    <div
                      className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                        overEstimate ? "bg-live" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                    />
                  )}
                </div>
                <p className="text-muted-foreground shrink-0 text-sm">
                  {estimate === null ? (
                    <>これまで {Math.round(totalMin)}分</>
                  ) : (
                    <>
                      見積もり {estimate}分のうち{" "}
                      <span className={overEstimate ? "text-live font-bold" : "font-bold"}>
                        {Math.round(totalMin)}分
                      </span>
                      {overEstimate && (
                        <span className="text-live font-bold">
                          {" "}
                          （{Math.round(totalMin - estimate)}分オーバー）
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card flex flex-wrap items-center gap-4 rounded-3xl p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
              <span aria-hidden className="bg-muted size-4 shrink-0 rounded-full" />
              <p className="text-muted-foreground flex-1 text-base">計測していません</p>
              <button
                type="button"
                onClick={openPalette}
                className="bg-primary focus-visible:ring-primary inline-flex shrink-0 items-center gap-2.5 rounded-full px-7 py-3.5 text-base font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none active:scale-[0.98]"
              >
                <span
                  aria-hidden
                  className="border-y-[6px] border-l-[10px] border-y-transparent border-l-white"
                />
                開始
                <kbd className="hidden text-xs font-medium opacity-80 sm:inline">⌘K</kbd>
              </button>
            </div>
          )}
        </div>
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
