"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/** 送信中は自動で disabled になる送信ボタン。form の中でだけ使う */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {children}
    </Button>
  );
}
