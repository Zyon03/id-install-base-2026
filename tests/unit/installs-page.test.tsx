import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

// Imported after the mock so the page picks up the mocked cookies() function.
import InstallsPage from "@/app/installs/page";
import { createInstallsSessionToken, INSTALLS_SESSION_COOKIE } from "@/lib/auth";

// jsdom has no ResizeObserver; MUI X Data Grid (rendered inside the page) needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("InstallsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    process.env.AUTH_COOKIE_SECRET = "test-secret";

    // Pre-authenticated for this suite — it's testing the grid, not the gate.
    const token = createInstallsSessionToken();
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === INSTALLS_SESSION_COOKIE ? { value: token } : undefined,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          equipment: [],
          pagination: { page: 1, page_size: 50, total_items: 0, total_pages: 0 },
        },
      }),
    } as Response);
  });

  it("renders the Install Base heading", async () => {
    // InstallsPage is now an async Server Component (reads cookies()) — RTL
    // can't render it directly, so resolve it first and render the result.
    render(await InstallsPage());
    expect(screen.getByRole("heading", { name: /install base/i })).toBeInTheDocument();

    // Let the grid's on-mount fetch settle within act() before the test ends.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });
});
