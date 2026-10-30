// Suggests a URL name from an organization name: a-z, 0-9 and single dashes.
// Names with no Latin letters or digits (for example Bangla) give "" and the
// user types the slug themselves.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}
