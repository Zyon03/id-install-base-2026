import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/equipment";
import {
  createInstallsSessionToken,
  INSTALLS_SESSION_COOKIE,
  INSTALLS_SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

const loginSchema = z
  .object({
    password: z.string(),
  })
  .strict();

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Request body must be valid JSON.");
  }

  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid request body.", z.flattenError(parsed.error));
  }

  try {
    const config = await prisma.appConfig.findFirst();

    // Same generic response whether the password is wrong or AppConfig
    // doesn't exist yet — never hint at which.
    if (!config || parsed.data.password !== config.installsPassword) {
      return errorResponse(401, "invalid_password", "Incorrect password.");
    }

    const response = NextResponse.json({ data: { authenticated: true } });
    response.cookies.set({
      name: INSTALLS_SESSION_COOKIE,
      value: createInstallsSessionToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: INSTALLS_SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("POST /api/auth/installs-login failed:", error);
    return errorResponse(500, "internal_error", "Something went wrong while checking the password.");
  }
}
