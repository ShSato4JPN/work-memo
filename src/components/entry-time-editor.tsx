"use client";

import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { useEntryTimeEditor } from "@/hooks/use-entry-time-editor";

/**
 * ログ1行の開始・終了時刻をその場で修正する。
 *
 * 計測中の記録は開始時刻だけを編集できる。ここで終了時刻を入れられると
 * 「停止したつもりがない計測が終わる」ことになり、計測を終わらせる手段が
 * 「停止」ボタンと復旧パネルに一本化されなくなるため。
 */
export function EntryTimeEditor({
  entryId,
  title,
  startedAt,
  endedAt,
}: {
  entryId: number;
  title: string;
  startedAt: Date;
  endedAt: Date | null;
}) {
  const editor = useEntryTimeEditor({ entryId, startedAt, endedAt });

  if (!editor.open) {
    return (
      <button
        type="button"
        onClick={editor.openEditor}
        aria-label={`「${title}」の時刻を修正`}
        className="border-input hover:bg-accent focus-visible:ring-primary rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:ring-4 focus-visible:outline-none"
      >
        時刻を修正
      </button>
    );
  }

  return (
    <div className="bg-background mt-3 basis-full space-y-3 rounded-2xl p-4">
      <form action={editor.save} className="flex flex-wrap items-end gap-2">
        <Input
          type="datetime-local"
          name="startedAt"
          aria-label="開始時刻"
          value={editor.startValue}
          onChange={(event) => editor.setStartValue(event.target.value)}
          className="border-input bg-card h-11 w-56 rounded-xl border px-3 text-base"
          required
        />
        {editor.isRunning ? (
          <p className="text-muted-foreground text-sm">
            計測中の記録は開始時刻のみ修正できます（終了は「停止」から）
          </p>
        ) : (
          <Input
            type="datetime-local"
            name="endedAt"
            aria-label="終了時刻"
            value={editor.endValue}
            onChange={(event) => editor.setEndValue(event.target.value)}
            className="border-input bg-card h-11 w-56 rounded-xl border px-3 text-base"
            required
          />
        )}
        <SubmitButton className="bg-primary rounded-full px-6 py-2.5 text-sm font-bold text-white hover:brightness-95">
          保存
        </SubmitButton>
        <button
          type="button"
          onClick={editor.close}
          className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
        >
          キャンセル
        </button>
      </form>

      {editor.error && <p className="text-live text-sm font-bold">{editor.error}</p>}
    </div>
  );
}
