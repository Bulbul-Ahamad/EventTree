import { LoginForm } from "@/features/auth/components/login-form";
import { sanitizeNext } from "@/lib/route-guards";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(typeof params.next === "string" ? params.next : null);

  return (
    <>
      <h1 className="text-balance text-2xl font-bold">Log in</h1>
      <LoginForm next={next ?? undefined} callbackFailed={params.error === "callback"} />
    </>
  );
}
