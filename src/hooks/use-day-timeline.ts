"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useNow } from "@/hooks/use-now";
import {
  groupBlocksByTask,
  initialScrollLeft,
  layoutDay,
  type TimelineBlock,
  type TimelineInput,
  type TimelineRow,
} from "@/lib/timeline";

const MS_PER_MIN = 60_000;
/** 秒を出さないので、30秒ごとに引き直せば現在線のずれは目に見えない */
const TICK_MS = 30_000;

export type UseDayTimeline = {
  blocks: TimelineBlock[];
  rows: TimelineRow[];
  /** 0時からの経過分で表した現在位置。その日でなければ null（現在線を引かない） */
  nowMinute: number | null;
  scrollRef: RefObject<HTMLDivElement | null>;
};

/**
 * 1日の時間軸に必要な計算をまとめる。
 *
 * 位置と長さの計算は layoutDay（テスト済みの純粋関数）に任せ、ここでは
 * 時計を進めること・行にまとめること・初期スクロール位置を当てることだけを行う。
 */
export function useDayTimeline(
  entries: TimelineInput[],
  day: Date,
  now: Date,
  pxPerMinute: number,
  minutesPerDay: number,
): UseDayTimeline {
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveNow = useNow(TICK_MS, now);

  const blocks = layoutDay(entries, day, liveNow);
  const scrollLeft = initialScrollLeft(blocks, pxPerMinute);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = scrollLeft;
  }, [scrollLeft]);

  const minuteOfDay = (liveNow.getTime() - new Date(day).setHours(0, 0, 0, 0)) / MS_PER_MIN;

  return {
    blocks,
    rows: groupBlocksByTask(blocks),
    nowMinute: minuteOfDay >= 0 && minuteOfDay <= minutesPerDay ? minuteOfDay : null,
    scrollRef,
  };
}
