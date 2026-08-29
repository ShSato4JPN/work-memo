/**
 * 記録の時刻修正フォームの入力を、保存できる値に変換する。
 *
 * datetime-local が返すのは "2026-08-30T09:00" という文字列なので、
 * Date に直せるか・順序が正しいかをここで判断する。
 * 未来かどうかの最終判断はサーバで行う（クライアントの時計は当てにできない）。
 */

export type EntryTimeInput = {
  startValue: string;
  endValue: string;
  /** 計測中の記録は終了時刻を持たない。終了は「停止」に一本化している */
  isRunning: boolean;
};

export type EntryTimeParseResult =
  | { ok: true; startedAt: Date; endedAt: Date | null }
  | { ok: false; message: string };

export function parseEntryTimeInput(input: EntryTimeInput): EntryTimeParseResult {
  if (input.startValue === "") return { ok: false, message: "開始時刻を入力してください" };

  const startedAt = new Date(input.startValue);
  if (Number.isNaN(startedAt.getTime())) {
    return { ok: false, message: "開始時刻の形式が正しくありません" };
  }

  if (input.isRunning) return { ok: true, startedAt, endedAt: null };

  if (input.endValue === "") return { ok: false, message: "終了時刻を入力してください" };

  const endedAt = new Date(input.endValue);
  if (Number.isNaN(endedAt.getTime())) {
    return { ok: false, message: "終了時刻の形式が正しくありません" };
  }
  if (endedAt <= startedAt) {
    return { ok: false, message: "終了時刻は開始時刻より後にしてください" };
  }

  return { ok: true, startedAt, endedAt };
}
