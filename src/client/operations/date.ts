export function dayStart(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dayEnd(value: number): number {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function addDays(value: number, amount: number): number {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date.getTime();
}

export function weekStart(value: number): number {
  const date = new Date(dayStart(value));
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.getTime();
}

export function sameDay(left: number, right: number): boolean {
  return dayStart(left) === dayStart(right);
}

export function inputDate(value: number): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function noon(value: string): number {
  return new Date(`${value}T12:00:00`).getTime();
}

export function shortDate(value: number): string {
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}
