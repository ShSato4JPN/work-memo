/**
 * 画面に出す時間の書き方をここに集める。
 *
 * 同じ「90分」を、ある画面では「1時間30分」、別の画面では「90分」と書いてしまうと、
 * 同じ数字なのか違う数字なのか読み手に判断させることになる。表記は1箇所で決める。
 */

/**
 * 分を「45分」「1時間」「1時間30分」の形にする。
 *
 * 経過しているのに四捨五入で「0分」になる場合は「1分未満」と書く。
 * 「0分」と出しておきながら割合は100%、という読めない表示を作らないため。
 */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (minutes > 0 && rounded === 0) return "1分未満";
  if (rounded < 60) return `${rounded}分`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/** 計測中の経過を「0:04:16」の形にする。秒まで動くので桁を固定する */
export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return `${hours}:${mmss}`;
}

/**
 * 見積もりとの差を符号付きで書く。
 * 「30分」だけだと超過なのか余りなのか読めないので、向きを必ず示す。
 */
export function formatDiff(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return "±0分";
  return rounded > 0 ? `+${formatDuration(rounded)}` : `-${formatDuration(-rounded)}`;
}

/** 0時からの経過分を「09:30」という時刻表記にする */
export function formatClockLabel(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = Math.floor(minuteOfDay % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
