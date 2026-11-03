import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Avatar, AvatarUrlsProvider } from "@/components/ui/avatar";
import { detectImageType } from "@/lib/image-type";
import { MAX_AVATAR_BYTES, avatarPath, avatarValue, storagePathOf } from "@/lib/avatar";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const uploadAvatar = vi.fn();
const removeAvatar = vi.fn();
vi.mock("@/features/auth/avatar-actions", () => ({
  uploadAvatar: (...a: unknown[]) => uploadAvatar(...a),
  removeAvatar: (...a: unknown[]) => removeAvatar(...a),
}));
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

import { AvatarUpload } from "@/features/auth/components/avatar-upload";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("detectImageType (the file's bytes decide, not its name)", () => {
  it("knows JPEG, PNG and WebP", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0]);
    expect(detectImageType(webp)).toBe("image/webp");
  });

  it("rejects everything else, including text, html, svg, gif and short input", () => {
    const text = (s: string) => new TextEncoder().encode(s);
    expect(detectImageType(text("hello, I am not a png"))).toBeNull();
    expect(detectImageType(text("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(text("GIF89a......"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    // RIFF but not WebP (a WAV file, say)
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });
});

describe("avatar paths", () => {
  it("one object per user, with a version in the stored value", () => {
    expect(avatarPath("u1")).toBe("u1/avatar");
    expect(avatarValue("u1", 5)).toBe("u1/avatar?v=5");
    expect(storagePathOf("u1/avatar?v=5")).toBe("u1/avatar");
    expect(storagePathOf("u1/avatar")).toBe("u1/avatar");
    expect(MAX_AVATAR_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("Avatar with a picture", () => {
  it("shows the picture of the person whose id has a URL, and initials for everyone else", () => {
    const { container } = render(
      <AvatarUrlsProvider urls={{ u1: "https://x.supabase.co/sign/u1.png" }}>
        <Avatar id="u1" name="Ada Lovelace" />
        <Avatar id="u2" name="Grace Hopper" />
      </AvatarUrlsProvider>,
    );
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toBe("https://x.supabase.co/sign/u1.png");
    expect(images[0]?.getAttribute("alt")).toBe(""); // decorative: the name is in text next to it
    expect(screen.getByText("GH")).toBeInTheDocument();
    expect(screen.queryByText("AL")).not.toBeInTheDocument();
  });

  it("falls back to initials when the picture fails to load", () => {
    const { container } = render(
      <AvatarUrlsProvider urls={{ u1: "https://x.supabase.co/sign/u1.png" }}>
        <Avatar id="u1" name="Ada Lovelace" />
      </AvatarUrlsProvider>,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img as Element);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("is initials only without a provider", () => {
    const { container } = render(<Avatar id="u1" name="Ada Lovelace" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });
});

describe("AvatarUpload", () => {
  beforeEach(() => vi.clearAllMocks());

  const picker = () => screen.getByLabelText("Choose a profile picture") as HTMLInputElement;
  const pick = (file: File) => fireEvent.change(picker(), { target: { files: [file] } });
  const png = (size = 10) => new File([new Uint8Array(size)], "me.png", { type: "image/png" });

  it("offers Upload when there is no picture and Change + Remove when there is", () => {
    const { rerender } = render(<AvatarUpload userId="u1" name="Ada" hasAvatar={false} />);
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
    rerender(<AvatarUpload userId="u1" name="Ada" hasAvatar />);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
  });

  it("only accepts jpeg, png and webp files in the picker", () => {
    render(<AvatarUpload userId="u1" name="Ada" hasAvatar={false} />);
    expect(picker().accept).toBe("image/jpeg,image/png,image/webp");
  });

  it("uploads the chosen file, then refreshes the page", async () => {
    uploadAvatar.mockResolvedValue({ ok: true, data: { avatarUrl: "u1/avatar?v=1" } });
    render(<AvatarUpload userId="u1" name="Ada" hasAvatar={false} />);
    pick(png());
    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledTimes(1));
    const body = uploadAvatar.mock.calls[0]?.[0] as FormData;
    expect((body.get("file") as File).name).toBe("me.png");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("rejects a wrong type or a file over 10 MB before sending anything", async () => {
    render(<AvatarUpload userId="u1" name="Ada" hasAvatar={false} />);
    pick(new File(["hi"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a JPG, PNG or WebP image.");
    pick(png(MAX_AVATAR_BYTES + 1));
    expect(await screen.findByRole("alert")).toHaveTextContent("The image must be 10 MB or smaller.");
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it("shows the server's message when it refuses the file", async () => {
    uploadAvatar.mockResolvedValue({ ok: false, code: "E_FILE_TYPE", message: "Use a JPG, PNG or WebP image." });
    render(<AvatarUpload userId="u1" name="Ada" hasAvatar={false} />);
    pick(png());
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a JPG, PNG or WebP image.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("removes the picture and refreshes", async () => {
    removeAvatar.mockResolvedValue({ ok: true, data: undefined });
    render(<AvatarUpload userId="u1" name="Ada" hasAvatar />);
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    await waitFor(() => expect(removeAvatar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
