import { signInAdmin, signOutAdmin } from "../../../../lib/ruska/session.js";
import { readBody, redirectBack } from "../_respond.js";

export const prerender = false;

export async function POST({ request, cookies }) {
  const data = await readBody(request);

  if (String(data.action ?? "") === "logout") {
    signOutAdmin(cookies);
    return redirectBack(request, "/ruska/admin", { virhe: null });
  }

  const ok = await signInAdmin(cookies, data.password);
  return redirectBack(request, "/ruska/admin", {
    virhe: ok ? null : "Väärä salasana.",
  });
}
