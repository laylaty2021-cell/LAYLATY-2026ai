import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

export async function signup(app: FastifyInstance, emailPrefix: string) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/signup",
    payload: {
      email: `${emailPrefix}-${randomUUID()}@test.laylaty`,
      password: "password123",
      full_name: `${emailPrefix} Test User`,
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`signup failed: ${response.statusCode} ${response.body}`);
  }
  return response.json() as { user: { id: string }; access_token: string };
}

export async function createStore(app: FastifyInstance, accessToken: string, businessType = "hall") {
  const response = await app.inject({
    method: "POST",
    url: "/v1/stores",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { name: `Test Store ${randomUUID()}`, business_type: businessType },
  });
  if (response.statusCode !== 201) {
    throw new Error(`createStore failed: ${response.statusCode} ${response.body}`);
  }
  return response.json() as { id: string; default_branch_id: string };
}

export async function signupWithStore(app: FastifyInstance, emailPrefix: string, businessType = "hall") {
  const { user, access_token: accessToken } = await signup(app, emailPrefix);
  const store = await createStore(app, accessToken, businessType);
  return { user, accessToken, store };
}
