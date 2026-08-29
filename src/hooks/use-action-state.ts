"use client";

import { useCallback, useState } from "react";

/** Server Action が返す結果の共通形。失敗の理由はそのまま画面に出せる日本語 */
export type ActionResult = { ok: true } | { ok: false; message: string };

export type ActionState = {
  pending: boolean;
  error: string | null;
  /**
   * Server Action を実行し、送信中かどうかと失敗の理由を面倒みる。
   * 成功したら true を返すので、呼び出し側は成否で後始末を分けられる。
   */
  run: (action: () => Promise<ActionResult>, fallbackMessage: string) => Promise<boolean>;
  /** 入力が変わったときにエラーを消す。直したのに古い指摘が残るのを避ける */
  clearError: () => void;
};

/**
 * Server Action の呼び出しまわりをまとめる。
 *
 * どの画面でも扱いを揃えるのが目的:
 *   - 重複や入力不備のような「起こって当然の失敗」は例外にせず結果として受け取り、
 *     エラー画面に落とさず入力欄のそばに理由を出す
 *   - 通信断のような予期しない失敗だけを catch し、決まった文言に置き換える
 *   - 失敗しても入力は消さない（何が悪かったのか確かめられなくなるため）
 */
export function useActionState(): ActionState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<ActionResult>, fallbackMessage: string): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.message);
          return false;
        }
        return true;
      } catch {
        setError(fallbackMessage);
        return false;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { pending, error, run, clearError };
}
