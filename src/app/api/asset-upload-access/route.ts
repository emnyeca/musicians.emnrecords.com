import { makeAccessRouteHandlers } from "@/lib/assets/access-route";

export const runtime = "nodejs";

const handlers = makeAccessRouteHandlers("asset-upload");

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
