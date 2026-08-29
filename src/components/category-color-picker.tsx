"use client";

import { CATEGORY_PALETTE } from "@/lib/category-colors";

type Props = {
  value: string;
  onChange: (color: string) => void;
  /** 同じ画面に複数のピッカーが並ぶので、ラジオのグループ名を分ける */
  name: string;
};

export function CategoryColorPicker({ value, onChange, name }: Props) {
  return (
    <fieldset>
      <legend className="text-muted-foreground mb-2 text-sm">色</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_PALETTE.map((color) => (
          <label
            key={color}
            className={`size-9 cursor-pointer rounded-full ring-offset-2 ring-offset-[var(--card)] transition ${
              value === color ? "ring-foreground ring-2" : "hover:ring-border hover:ring-2"
            }`}
            style={{ backgroundColor: color }}
          >
            <input
              type="radio"
              name={name}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              className="sr-only"
            />
            <span className="sr-only">{color}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
