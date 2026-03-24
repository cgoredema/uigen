// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockCookieSet })),
}));

const { createSession } = await import("@/lib/auth");

describe("createSession", () => {
  beforeEach(() => {
    mockCookieSet.mockClear();
  });

  test("sets an auth-token cookie", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieSet).toHaveBeenCalledOnce();
    expect(mockCookieSet.mock.calls[0][0]).toBe("auth-token");
  });

  test("sets correct cookie options", async () => {
    await createSession("user-1", "test@example.com");

    const options = mockCookieSet.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("sets cookie expiry ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const expires: Date = mockCookieSet.mock.calls[0][2].expires;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("cookie value is a JWT containing userId and email", async () => {
    await createSession("user-1", "test@example.com");

    const token: string = mockCookieSet.mock.calls[0][1];
    const secret = new TextEncoder().encode("development-secret-key");
    const { payload } = await jwtVerify(token, secret);

    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("test@example.com");
  });

  test("JWT expires in ~7 days", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-1", "test@example.com");
    const after = Math.floor(Date.now() / 1000);

    const token: string = mockCookieSet.mock.calls[0][1];
    const secret = new TextEncoder().encode("development-secret-key");
    const { payload } = await jwtVerify(token, secret);

    const sevenDaysSec = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDaysSec - 5);
    expect(payload.exp).toBeLessThanOrEqual(after + sevenDaysSec + 5);
  });
});
