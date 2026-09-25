import { clearedAuthCookie, deleteSession } from "../../../../lib/session";

export async function POST(request: Request) {
  await deleteSession(request).catch(() => undefined);
  return Response.json({ loggedOut: true }, { headers: { "set-cookie": clearedAuthCookie() } });
}
