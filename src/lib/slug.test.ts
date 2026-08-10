import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a normal product name", () => {
    expect(slugify("Cworth 15kW Lithium Battery")).toBe("cworth-15kw-lithium-battery");
  });

  it("collapses multiple non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Solar Panel -- 400W (Mono)")).toBe("solar-panel-400w-mono");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("--Inverter 5kVA--")).toBe("inverter-5kva");
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("preserves numbers", () => {
    expect(slugify("Battery 200Ah")).toBe("battery-200ah");
  });
});
