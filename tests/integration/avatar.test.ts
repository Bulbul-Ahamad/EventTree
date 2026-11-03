// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { actAs, admin, cleanup, createPersona, type Persona } from "./helpers/harness";

vi.mock("@/lib/supabase/server", async () => {
  const { current } = await import("./helpers/session");
  return {
    createServerClient: async () => {
      if (!current.client) throw new Error("actAs() was not called");
      return current.client;
    },
  };
});

import { removeAvatar, uploadAvatar } from "@/features/auth/avatar-actions";
import { MAX_AVATAR_BYTES } from "@/lib/avatar";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

// A real 1x1 PNG, and the first bytes of a JPEG and a WebP.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const form = (bytes: BlobPart, name = "me.png", type = "image/png") => {
  const body = new FormData();
  body.set("file", new File([bytes], name, { type }));
  return body;
};

let alice: Persona;

beforeAll(async () => {
  alice = await createPersona("avatar-alice");
  actAs(alice);
});

afterAll(async () => {
  await admin.storage.from("avatars").remove([`${alice.id}/avatar`]);
  await cleanup();
});

const stored = async () => (await admin.from("profiles").select("avatar_url").eq("id", alice.id).single()).data?.avatar_url;
const objectExists = async () => {
  const { data } = await admin.storage.from("avatars").list(alice.id);
  return (data ?? []).some((o) => o.name === "avatar");
};

describe("uploadAvatar / removeAvatar", () => {
  it("rejects a text file renamed to .png (type comes from the bytes), nothing is stored", async () => {
    const r = await uploadAvatar(form("this is not an image", "evil.png", "image/png"));
    expect(r).toMatchObject({ ok: false, code: "E_FILE_TYPE" });
    expect(await objectExists()).toBe(false);
    expect(await stored()).toBeNull();
  });

  it("rejects html, svg and empty files", async () => {
    expect(await uploadAvatar(form("<script>alert(1)</script>", "x.png"))).toMatchObject({ code: "E_FILE_TYPE" });
    expect(await uploadAvatar(form('<svg xmlns="http://www.w3.org/2000/svg"/>', "x.png"))).toMatchObject({
      code: "E_FILE_TYPE",
    });
    expect(await uploadAvatar(form(new Uint8Array(0), "x.png"))).toMatchObject({ code: "E_FILE_TYPE" });
  });

  it("rejects a file over 2 MB even when it starts like a PNG", async () => {
    const big = new Uint8Array(MAX_AVATAR_BYTES + 1);
    big.set(PNG.subarray(0, 8));
    expect(await uploadAvatar(form(big))).toMatchObject({ ok: false, code: "E_FILE_TOO_LARGE" });
    expect(await objectExists()).toBe(false);
  });

  it("rejects a missing file field", async () => {
    expect(await uploadAvatar(new FormData())).toMatchObject({ ok: false, code: "E_VALIDATION" });
  });

  it("stores a real PNG in the user's own folder and records it on the profile", async () => {
    const r = await uploadAvatar(form(PNG));
    expect(r.ok).toBe(true);
    expect(await objectExists()).toBe(true);
    expect(await stored()).toMatch(new RegExp(`^${alice.id}/avatar\\?v=\\d+$`));
    // The owner can read it back with a signed URL, as the app does.
    const signed = await alice.client.storage.from("avatars").createSignedUrls([`${alice.id}/avatar`], 60);
    expect(signed.data?.[0]?.signedUrl).toBeTruthy();
  });

  it("replaces the picture with a new version", async () => {
    const before = await stored();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const r = await uploadAvatar(form(PNG));
    expect(r.ok).toBe(true);
    expect(await stored()).not.toBe(before);
  });

  it("removes the object and clears the profile", async () => {
    expect((await removeAvatar()).ok).toBe(true);
    expect(await objectExists()).toBe(false);
    expect(await stored()).toBeNull();
  });

  it("a guest cannot upload or remove", async () => {
    actAs(null);
    // No session at all: the harness has no client, so nothing can even be attempted.
    await expect(uploadAvatar(form(PNG))).rejects.toThrow();
    actAs(alice);
  });
});
