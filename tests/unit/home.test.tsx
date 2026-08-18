import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// Imported after the mock so the page picks up the mocked redirect().
import Home from "@/app/page";

describe("Home page", () => {
  it("redirects to /new", () => {
    Home();
    expect(redirectMock).toHaveBeenCalledWith("/new");
  });
});
