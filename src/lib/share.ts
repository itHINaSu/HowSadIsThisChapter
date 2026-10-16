import { publicUrl } from "./config";
import { SITE } from "./format";
import { toast } from "./toast";

/**
 * Share a book. Links never use the address the app happens to be open at
 * (that may be a private IP): with PUBLIC_URL set on the server they point to
 * this app on that domain, otherwise to the book on the original site.
 */
export async function shareBook(title: string, slug: string) {
  const base = publicUrl();
  const url = base ? `${base}/#/book/${encodeURIComponent(slug)}` : `${SITE}/book/${encodeURIComponent(slug)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    prompt("Copy this link", url);
  }
}
