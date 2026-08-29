import { revalidatePath } from "next/cache";

/**
 * タイマー操作・タスク操作は「今日」「タスク一覧」「分析」のどの画面の数字も動かしうるので、
 * まとめて再検証する。単一ユーザーのローカルアプリなので絞る意味がない。
 *
 * force-dynamic はサーバ側のレンダリングキャッシュの設定であって、Server Action の応答として
 * 現在のツリーを再描画させるものではない。再検証しないとユーザーが見ている画面は操作前のまま。
 */
export function revalidateAllViews(): void {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/analytics");
}
