import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { DisplayDemo } from "./display-demo";
import { ToastDemo } from "./toast-demo";

// Temporary visual check for step 1.22. Dev only; remove with the landing page (3.03).
export default function PrimitivesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">Primitives</h1>
        <ThemeToggle />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Default, disabled and loading for each variant.</CardDescription>
        </CardHeader>
        <CardContent>
          {(["primary", "secondary", "ghost", "destructive"] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm text-foreground-muted">{v}</span>
              <Button variant={v}>Label</Button>
              <Button variant={v}>
                <Plus aria-hidden /> With icon
              </Button>
              <Button variant={v} disabled>
                Disabled
              </Button>
              <Button variant={v} loading>
                Saving
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-sm text-foreground-muted">sizes</span>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="secondary" aria-label="Add">
              <Plus aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form fields</CardTitle>
          <CardDescription>Normal, hint, error, disabled. Tab through to see focus rings.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormField label="Full name" required>
            {(p) => <Input {...p} placeholder="Your name" />}
          </FormField>
          <FormField label="Email" hint="We never share your email.">
            {(p) => <Input {...p} type="email" defaultValue="owner@example.com" />}
          </FormField>
          <FormField label="Password" required error="Use at least 10 characters.">
            {(p) => <Input {...p} type="password" defaultValue="short" />}
          </FormField>
          <FormField label="Locked">
            {(p) => <Input {...p} disabled defaultValue="Read only" />}
          </FormField>
          <FormField label="Description (বাংলা)">
            {(p) => <Textarea {...p} lang="bn" defaultValue="ইভেন্টের বিবরণ এখানে লিখুন।" />}
          </FormField>
        </CardContent>
        <CardFooter>
          <Button variant="secondary">Cancel</Button>
          <Button>Save</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toasts</CardTitle>
          <CardDescription>Success and info close after 3 s, errors after 6 s. Hover to pause.</CardDescription>
        </CardHeader>
        <ToastDemo />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display primitives (3.01)</CardTitle>
          <CardDescription>Badges, progress, avatars, tabs, banners, skeletons, empty state.</CardDescription>
        </CardHeader>
        <DisplayDemo />
      </Card>
    </main>
  );
}
