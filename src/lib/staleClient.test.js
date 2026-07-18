import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportServerBuildVersion, handleReloadBroadcast } from "./staleClient";

describe("staleClient", () => {
  beforeEach(() => {
    sessionStorage.clear();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
  });

  describe("reportServerBuildVersion", () => {
    it("is a complete no-op when VITE_BUILD_VERSION is absent (local dev)", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "");
      const reload = vi.fn();

      reportServerBuildVersion("some-server-version", { reload });

      expect(reload).not.toHaveBeenCalled();
    });

    it("does nothing when the server buildVersion matches the embedded version", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
      const reload = vi.fn();

      reportServerBuildVersion("abc1234", { reload });

      expect(reload).not.toHaveBeenCalled();
    });

    it("does nothing when the server buildVersion is null (app-meta sentinel not yet written)", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
      const reload = vi.fn();

      reportServerBuildVersion(null, { reload });

      expect(reload).not.toHaveBeenCalled();
    });

    it("schedules a reload when the server buildVersion differs from the embedded version", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
      const reload = vi.fn();

      reportServerBuildVersion("def5678-mismatch", { reload });

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("defers the reload while a text input is focused, then reloads once it's safe", () => {
      vi.useFakeTimers();
      try {
        vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
        const reload = vi.fn();

        const input = document.createElement("input");
        input.type = "text";
        document.body.appendChild(input);
        input.focus();
        expect(document.activeElement).toBe(input);

        reportServerBuildVersion("focused-input-mismatch", { reload });
        expect(reload).not.toHaveBeenCalled();

        // Still focused a tick later — keeps deferring.
        vi.advanceTimersByTime(1000);
        expect(reload).not.toHaveBeenCalled();

        input.blur();
        vi.advanceTimersByTime(1000);
        expect(reload).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not defer for non-text inputs (checkboxes, buttons) — only text/textarea/contentEditable", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
      const reload = vi.fn();

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      document.body.appendChild(checkbox);
      checkbox.focus();

      reportServerBuildVersion("checkbox-focused-mismatch", { reload });

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("defers the reload while a modal overlay is open, then reloads once it closes", () => {
      vi.useFakeTimers();
      try {
        vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
        const reload = vi.fn();

        const overlay = document.createElement("div");
        overlay.className = "cc-modal-overlay";
        document.body.appendChild(overlay);

        reportServerBuildVersion("modal-open-mismatch", { reload });
        expect(reload).not.toHaveBeenCalled();

        overlay.remove();
        vi.advanceTimersByTime(1000);
        expect(reload).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("never reloads more than once per target version per tab within the guard window", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
      const reload = vi.fn();

      reportServerBuildVersion("repeated-mismatch", { reload });
      expect(reload).toHaveBeenCalledTimes(1);

      // A subsequent poll tick still reports the same mismatched server
      // version (e.g. S3 still serving a mixed/old bundle) — must not loop.
      reportServerBuildVersion("repeated-mismatch", { reload });
      reportServerBuildVersion("repeated-mismatch", { reload });

      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleReloadBroadcast", () => {
    it("is a complete no-op when VITE_BUILD_VERSION is absent (local dev)", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "");
      const reload = vi.fn();

      handleReloadBroadcast({ reload });

      expect(reload).not.toHaveBeenCalled();
    });

    it("reloads immediately (bypassing any version compare) when it's safe to do so", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
      const reload = vi.fn();

      handleReloadBroadcast({ reload });

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("defers while a text input is focused, same as a version-mismatch reload", () => {
      vi.useFakeTimers();
      try {
        vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
        const reload = vi.fn();

        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        textarea.focus();

        handleReloadBroadcast({ reload });
        expect(reload).not.toHaveBeenCalled();

        textarea.blur();
        vi.advanceTimersByTime(1000);
        expect(reload).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("the guard also limits repeated broadcast pushes to one reload per tab within the window", () => {
      vi.stubEnv("VITE_BUILD_VERSION", "abc1234");
      const reload = vi.fn();

      handleReloadBroadcast({ reload });
      handleReloadBroadcast({ reload });

      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
