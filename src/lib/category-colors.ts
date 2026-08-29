/**
 * カテゴリに選べる色。
 * 自由入力にすると全体のトーンから外れた色が混ざるので、ここに集約する。
 * 追加フォームと編集フォームの両方がこれを使う。
 */
export const CATEGORY_PALETTE = [
  "#4c8df6",
  "#35c08a",
  "#f2a93b",
  "#f2705c",
  "#a78bfa",
  "#f472b6",
  "#22b8cf",
  "#84cc16",
  "#98a6b8",
] as const;

/** 色は #rrggbb だけ受け付ける。画面のパレット以外を直接送られても壊れないようにする */
export const CATEGORY_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
