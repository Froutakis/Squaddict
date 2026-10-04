export const UNIQUE_VIOLATION = "23505";

// What to tell the person when a call fails. The SQL functions raise plain
// sentences ("Your squad already follows them."), so those are shown as they
// are; anything without a message gets the fallback.
export function errorText(problem: unknown, fallback: string): string {
  if (typeof problem === "string" && problem.length > 0) return problem;
  if (problem !== null && typeof problem === "object") {
    const message = (problem as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}
