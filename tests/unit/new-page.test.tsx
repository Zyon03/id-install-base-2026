import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import NewEntryPage from "@/app/new/page";

describe("NewEntryPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { customers: [] } }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the New Entry heading", () => {
    render(<NewEntryPage />);
    expect(screen.getByRole("heading", { name: /new entry/i })).toBeInTheDocument();
  });

  it("renders the equipment install form", () => {
    render(<NewEntryPage />);
    expect(screen.getByRole("button", { name: /save install/i })).toBeInTheDocument();
  });
});
