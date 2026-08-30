import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "../auth/jwt.js";
import { unauthenticated } from "../errors.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw unauthenticated("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
  } catch {
    throw unauthenticated("Invalid or expired token");
  }
}
