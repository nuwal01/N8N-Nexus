import "server-only";

export function appUrl(path: string, requestUrl: string) {
  const configured = process.env.APP_URL?.trim();
  const base = configured || requestUrl;

  try {
    const url = new URL(path, base);
    const configuredUrl = configured ? new URL(configured) : null;
    if (!["http:", "https:"].includes(url.protocol) || (configuredUrl && !["http:", "https:"].includes(configuredUrl.protocol))) {
      throw new Error("APP_URL must use HTTP.");
    }
    if (configuredUrl && url.origin !== configuredUrl.origin) {
      throw new Error("APP_URL must be an origin.");
    }
    return url;
  } catch {
    throw new Error("APP_URL must be a valid http:// or https:// URL.");
  }
}
