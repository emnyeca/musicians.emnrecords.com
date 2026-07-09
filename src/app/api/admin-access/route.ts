import { makeAccessRouteHandlers } from "@/lib/assets/access-route";

export const runtime = "nodejs";

const handlers = makeAccessRouteHandlers("admin");

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
