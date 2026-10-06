/** The sky follows the local time of day (visual only — never sent anywhere). */
export type Daypart = "dawn" | "day" | "golden" | "dusk" | "night";

export function daypart(hour: number): Daypart {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "golden";
  if (hour >= 19 && hour < 21) return "dusk";
  return "night";
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Hello, night owl";
}
