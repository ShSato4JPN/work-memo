"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">エラーが発生しました</h1>
      <p className="text-muted-foreground text-sm">
        画面の表示中に問題が起きました。しばらくしてからやり直してください。
      </p>
      <Button onClick={() => reset()}>やり直す</Button>
    </main>
  );
}
