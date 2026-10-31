import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeRadio } from "@/components/shell/theme-radio";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { createServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound(); // middleware already redirects guests
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">Profile</h1>
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <ProfileForm initialName={profile.full_name} email={profile.email} />
      </Card>
      <Card>
        <ThemeRadio />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <div>
          <LogoutButton />
        </div>
      </Card>
    </div>
  );
}
