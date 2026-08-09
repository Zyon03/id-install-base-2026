import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InstallsPage from "@/app/installs/page";

describe("InstallsPage", () => {
  it("renders the Install Base heading", () => {
    render(<InstallsPage />);
    expect(screen.getByRole("heading", { name: /install base/i })).toBeInTheDocument();
  });
});
