import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstallsPage from "@/app/installs/page";

// jsdom has no ResizeObserver; MUI X Data Grid (rendered inside the page) needs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("InstallsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
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
    render(<InstallsPage />);
    expect(screen.getByRole("heading", { name: /install base/i })).toBeInTheDocument();

    // Let the grid's on-mount fetch settle within act() before the test ends.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });
});
