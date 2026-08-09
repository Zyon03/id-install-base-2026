import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/installs",
}));

import { Nav } from "@/components/layout/Nav";

describe("Nav", () => {
  it("renders links to the Install Base grid and the New Entry form", () => {
    render(<Nav />);

    const installsLink = screen.getByRole("link", { name: /install base/i });
    expect(installsLink).toHaveAttribute("href", "/installs");

    const newEntryLink = screen.getByRole("link", { name: /new entry/i });
    expect(newEntryLink).toHaveAttribute("href", "/new");
  });
});
