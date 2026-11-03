import { describe, expect, it } from "vitest";
import { redactUrl } from "./redact";

describe("redactUrl", () => {
  it("removes stakeholder and firm invite tokens", () => {
    expect(redactUrl("https://bridgegen.io/respond/abc123SECRET")).toBe("https://bridgegen.io/respond/:token");
    expect(redactUrl("https://bridgegen.io/join/xyzSECRET")).toBe("https://bridgegen.io/join/:token");
  });

  it("replaces company ids", () => {
    expect(redactUrl("https://bridgegen.io/companies/3f2b6c1e-8d4a-4b7e-9c2d-1a2b3c4d5e6f/room"))
      .toBe("https://bridgegen.io/companies/:id/room");
  });

  it("drops query strings and hashes", () => {
    expect(redactUrl("https://bridgegen.io/login?next=/respond/SECRET#x")).toBe("https://bridgegen.io/login");
  });

  it("keeps public routes as they are", () => {
    expect(redactUrl("https://bridgegen.io/simulator")).toBe("https://bridgegen.io/simulator");
    expect(redactUrl("https://bridgegen.io/")).toBe("https://bridgegen.io/");
  });

  it("falls back to / for anything unparseable", () => {
    expect(redactUrl("not a url")).toBe("/");
  });
});
