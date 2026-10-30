// The generated Database types mark every RPC parameter as non-null, but the
// SQL functions accept NULL for optional ones and PostgREST sends JSON null.
// This is the single place that bridges the two (narrowing cast, no `unknown`).
export function nullable(value: string | null | undefined): string {
  return (value ?? null) as string;
}
