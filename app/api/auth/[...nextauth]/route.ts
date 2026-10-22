// @api run the NextAuth pipeline: providers, callbacks, session and sign-out
import type { NextRequest } from "next/server";
import { GET as authGET, POST as authPOST } from "@/lib/auth/auth";
import { withRequestApp } from "@/lib/auth/apps";

// 554-3: каждый запрос к NextAuth идёт в приложении своего адреса возврата — адаптер (Google, письмо) ищет и создаёт человека в нём.
export const GET = (req: NextRequest) => withRequestApp(req, () => authGET(req));
export const POST = (req: NextRequest) => withRequestApp(req, () => authPOST(req));
