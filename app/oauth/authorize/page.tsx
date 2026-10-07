import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OAuthConsent } from "@/components/oauth-consent";
import { createAuthCode, parseAuthorizeRequest } from "@/lib/oauth";
import { parseTokenScope } from "@/lib/token-auth";

/**
 * /oauth/authorize — the consent page an MCP connector (claude.ai web or
 * mobile) sends the user to. Cookie-session only: proxy.ts sends a signed-out
 * visitor through /signin and back here with the query intact. Nothing is
 * granted until the signed-in user presses Allow, and the grant is that
 * user's own journal, at the access level they pick.
 */
type Params = Record<string, string | undefined>;

function firstValues(raw: Record<string, string | string[] | undefined>): Params {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

async function decide(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  // The hidden fields are only as trustworthy as the query: check them all again.
  const req = await parseAuthorizeRequest({
    response_type: "code",
    code_challenge_method: "S256",
    client_id: get("client_id"),
    redirect_uri: get("redirect_uri"),
    code_challenge: get("code_challenge"),
    state: get("state"),
  });
  if (!req) redirect("/");

  const back = new URL(req.redirectUri);
  if (req.state) back.searchParams.set("state", req.state);

  const scope = parseTokenScope(get("scope"));
  if (get("decision") !== "approve" || !scope) {
    back.searchParams.set("error", "access_denied");
    redirect(back.toString());
  }

  const code = await createAuthCode({
    clientId: req.client.clientId,
    ownerId: session.user.id,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    scope,
  });
  back.searchParams.set("code", code);
  redirect(back.toString());
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const req = await parseAuthorizeRequest(firstValues(await searchParams));

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4.5 py-8">
      <OAuthConsent
        request={
          req && {
            clientName: req.client.name,
            redirectHost: new URL(req.redirectUri).host || new URL(req.redirectUri).protocol,
            clientId: req.client.clientId,
            redirectUri: req.redirectUri,
            codeChallenge: req.codeChallenge,
            state: req.state,
            defaultScope: req.defaultScope,
          }
        }
        action={decide}
      />
    </div>
  );
}
