/**
 * CSS cleanup verification tests
 * Ensures removed CSS classes are no longer present and core classes remain
 */

import fs from "fs";
import path from "path";

describe("CSS Cleanup Verification", () => {
  let globalsCss: string;
  let rtlCss: string;

  beforeAll(() => {
    globalsCss = fs.readFileSync(
      path.join(__dirname, "../app/globals.css"),
      "utf-8",
    );
    rtlCss = fs.readFileSync(path.join(__dirname, "../app/rtl.css"), "utf-8");
  });

  describe("globals.css unused classes removed", () => {
    it("does not contain .container-responsive", () => {
      expect(globalsCss).not.toMatch(/\.container-responsive/);
    });

    it("does not contain .touch-target", () => {
      expect(globalsCss).not.toMatch(/\.touch-target/);
    });
  });

  describe("rtl.css unused classes removed", () => {
    it("does not contain .flex-row-reverse-rtl", () => {
      expect(rtlCss).not.toMatch(/\.flex-row-reverse-rtl/);
    });

    it("does not contain .rtl-flip-x", () => {
      expect(rtlCss).not.toMatch(/\.rtl-flip-x/);
    });

    it("does not contain .rtl-progress", () => {
      expect(rtlCss).not.toMatch(/\.rtl-progress/);
    });

    it("does not contain .breadcrumb-separator", () => {
      expect(rtlCss).not.toMatch(/\.breadcrumb-separator/);
    });

    it("does not contain .icon-directional", () => {
      expect(rtlCss).not.toMatch(/\.icon-directional/);
    });

    it("does not contain .toast-container", () => {
      expect(rtlCss).not.toMatch(/\.toast-container/);
    });

    it("does not contain .modal-close", () => {
      expect(rtlCss).not.toMatch(/\.modal-close/);
    });

    it("does not contain .dropdown-menu", () => {
      expect(rtlCss).not.toMatch(/\.dropdown-menu/);
    });
  });

  describe("core CSS classes preserved", () => {
    it("preserves .ds-card", () => {
      expect(globalsCss).toMatch(/\.ds-card/);
    });

    it("preserves .ds-btn-primary", () => {
      expect(globalsCss).toMatch(/\.ds-btn-primary/);
    });

    it("preserves .ds-btn-ghost", () => {
      expect(globalsCss).toMatch(/\.ds-btn-ghost/);
    });

    it("preserves .ds-input", () => {
      expect(globalsCss).toMatch(/\.ds-input/);
    });

    it("preserves animation classes", () => {
      expect(globalsCss).toMatch(/\.animate-shimmer/);
      expect(globalsCss).toMatch(/\.skeleton-shimmer/);
      expect(globalsCss).toMatch(/\.animate-fade-in/);
    });

    it("preserves logical property utilities in rtl.css", () => {
      expect(rtlCss).toMatch(/\.ps-/);
      expect(rtlCss).toMatch(/\.pe-/);
      expect(rtlCss).toMatch(/\.ms-/);
      expect(rtlCss).toMatch(/\.me-/);
    });

    it("preserves sr-only accessibility class", () => {
      expect(globalsCss).toMatch(/\.sr-only/);
    });
  });
});
