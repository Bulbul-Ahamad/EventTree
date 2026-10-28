// Runs once when the server boots. Importing env validates it, so a missing
// variable stops the app immediately with a clear message.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
