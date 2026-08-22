import { renderHook, act } from "@testing-library/react";
import { useCampaignFilters } from "./useCampaignFilters";
import { useRouter, useSearchParams } from "next/navigation";

jest.mock("next/navigation");

function lastReplaceUrl(mockRouter: Record<string, jest.Mock>): URL {
  const [url] = mockRouter.replace.mock.calls[
    mockRouter.replace.mock.calls.length - 1
  ] as [string];
  return new URL(url, "http://localhost");
}

/** Simulates the router applying the last replace() call so the next render sees it. */
function simulateNavigation(
  mockRouter: Record<string, jest.Mock>,
  mockSearchParams: URLSearchParams,
  rerender: () => void,
) {
  const url = lastReplaceUrl(mockRouter);
  Array.from(mockSearchParams.keys()).forEach((key) =>
    mockSearchParams.delete(key),
  );
  url.searchParams.forEach((value, key) => mockSearchParams.set(key, value));
  rerender();
}

describe("useCampaignFilters", () => {
  let mockRouter: Record<string, jest.Mock>;
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    mockRouter = {
      replace: jest.fn(),
    };
    mockSearchParams = new URLSearchParams();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with default values", () => {
      const { result } = renderHook(() => useCampaignFilters());

      expect(result.current.filters.filter).toBe("all");
      expect(result.current.filters.sort).toBe("recent");
      expect(result.current.filters.query).toBe("");
      expect(result.current.filters.category).toBe("");
      expect(result.current.filters.page).toBe(1);
      expect(result.current.filters.goalMin).toBe("");
      expect(result.current.filters.goalMax).toBe("");
      expect(result.current.filters.dateFrom).toBe("");
      expect(result.current.filters.dateTo).toBe("");
      expect(result.current.showAdvanced).toBe(false);
      expect(result.current.hasAdvanced).toBe(false);
      expect(result.current.activeGoalMin).toBeNull();
      expect(result.current.activeGoalMax).toBeNull();
      expect(result.current.activeDateFrom).toBeNull();
      expect(result.current.activeDateTo).toBeNull();
    });

    it("should read all filter state from URL search params (read direction of URL sync)", () => {
      mockSearchParams.set("filter", "active");
      mockSearchParams.set("sort", "popular");
      mockSearchParams.set("q", "education");
      mockSearchParams.set("category", "tech");
      mockSearchParams.set("page", "2");
      mockSearchParams.set("goalMin", "1000");
      mockSearchParams.set("goalMax", "50000");
      mockSearchParams.set("dateFrom", "2024-01-01");
      mockSearchParams.set("dateTo", "2024-12-31");

      const { result } = renderHook(() => useCampaignFilters());

      expect(result.current.filters).toMatchObject({
        filter: "active",
        sort: "popular",
        query: "education",
        category: "tech",
        page: 2,
        goalMin: "1000",
        goalMax: "50000",
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
      });
      expect(result.current.activeGoalMin).toBe(1000);
      expect(result.current.activeGoalMax).toBe(50000);
      expect(result.current.activeDateFrom).toBe("2024-01-01");
      expect(result.current.activeDateTo).toBe("2024-12-31");
    });
  });

  describe("individual filter state transitions (setParam)", () => {
    it("sets the filter param and writes it to the URL (write direction of URL sync)", () => {
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("filter", "active");
      });

      expect(lastReplaceUrl(mockRouter).searchParams.get("filter")).toBe(
        "active",
      );
    });

    it("clears the filter param by setting it back to 'all' (the default)", () => {
      mockSearchParams.set("filter", "active");
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("filter", "all");
      });

      expect(lastReplaceUrl(mockRouter).searchParams.has("filter")).toBe(false);
    });

    it("sets the sort param and writes it to the URL", () => {
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("sort", "popular");
      });

      expect(lastReplaceUrl(mockRouter).searchParams.get("sort")).toBe(
        "popular",
      );
    });

    it("clears the sort param by setting it back to 'recent' (the default)", () => {
      mockSearchParams.set("sort", "popular");
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("sort", "recent");
      });

      expect(lastReplaceUrl(mockRouter).searchParams.has("sort")).toBe(false);
    });

    it("sets the category param and clears it via an empty string", () => {
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("category", "tech");
      });
      expect(lastReplaceUrl(mockRouter).searchParams.get("category")).toBe(
        "tech",
      );

      act(() => {
        result.current.setParam("category", "");
      });
      expect(lastReplaceUrl(mockRouter).searchParams.has("category")).toBe(
        false,
      );
    });

    it("resets the page param whenever a non-page filter changes", () => {
      mockSearchParams.set("page", "5");
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("category", "tech");
      });

      expect(lastReplaceUrl(mockRouter).searchParams.has("page")).toBe(false);
    });

    it("preserves the page param when the changed key is 'page' itself", () => {
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("page", "3");
      });

      expect(lastReplaceUrl(mockRouter).searchParams.get("page")).toBe("3");
    });

    it("combines multiple filters together in the URL rather than overwriting each other", () => {
      const { result, rerender } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setParam("filter", "active");
      });
      simulateNavigation(mockRouter, mockSearchParams, rerender);

      act(() => {
        result.current.setParam("category", "tech");
      });
      simulateNavigation(mockRouter, mockSearchParams, rerender);

      act(() => {
        result.current.setParam("sort", "popular");
      });

      const url = lastReplaceUrl(mockRouter);
      expect(url.searchParams.get("filter")).toBe("active");
      expect(url.searchParams.get("category")).toBe("tech");
      expect(url.searchParams.get("sort")).toBe("popular");
    });
  });

  describe("debounced query input", () => {
    it("syncs inputValue to the 'q' param after the debounce window", () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setInputValue("test");
      });
      expect(mockRouter.replace).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(lastReplaceUrl(mockRouter).searchParams.get("q")).toBe("test");
      jest.useRealTimers();
    });

    it("resyncs inputValue from the URL when the 'q' param changes externally", () => {
      const { result, rerender } = renderHook(() => useCampaignFilters());
      expect(result.current.inputValue).toBe("");

      mockSearchParams.set("q", "external-change");
      rerender();

      expect(result.current.inputValue).toBe("external-change");
    });
  });

  describe("advanced filters", () => {
    it("applies advanced filters (goal range + date range) to the URL and closes the panel", () => {
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setShowAdvanced(true);
        result.current.setGoalMin("1000");
        result.current.setGoalMax("50000");
        result.current.setDateFrom("2024-01-01");
        result.current.setDateTo("2024-12-31");
      });

      act(() => {
        result.current.applyAdvanced();
      });

      const url = lastReplaceUrl(mockRouter);
      expect(url.searchParams.get("goalMin")).toBe("1000");
      expect(url.searchParams.get("goalMax")).toBe("50000");
      expect(url.searchParams.get("dateFrom")).toBe("2024-01-01");
      expect(url.searchParams.get("dateTo")).toBe("2024-12-31");
      expect(url.searchParams.has("page")).toBe(false);
      expect(result.current.showAdvanced).toBe(false);
    });

    it("deletes advanced params that are left empty while applying only the ones that are set", () => {
      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.setGoalMin("2000");
        // goalMax, dateFrom, dateTo left empty
      });

      act(() => {
        result.current.applyAdvanced();
      });

      const url = lastReplaceUrl(mockRouter);
      expect(url.searchParams.get("goalMin")).toBe("2000");
      expect(url.searchParams.has("goalMax")).toBe(false);
      expect(url.searchParams.has("dateFrom")).toBe(false);
      expect(url.searchParams.has("dateTo")).toBe(false);
    });

    it("detects hasAdvanced when any advanced filter is present in the URL", () => {
      mockSearchParams.set("goalMin", "1000");
      const { result } = renderHook(() => useCampaignFilters());

      expect(result.current.hasAdvanced).toBe(true);
    });

    it("toggles the advanced filter panel", () => {
      const { result } = renderHook(() => useCampaignFilters());

      expect(result.current.showAdvanced).toBe(false);

      act(() => {
        result.current.setShowAdvanced(true);
      });

      expect(result.current.showAdvanced).toBe(true);
    });
  });

  describe("reset behavior (clearAdvanced)", () => {
    it("clears all advanced local state back to empty strings", () => {
      mockSearchParams.set("goalMin", "1000");
      mockSearchParams.set("goalMax", "50000");
      mockSearchParams.set("dateFrom", "2024-01-01");
      mockSearchParams.set("dateTo", "2024-12-31");

      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.clearAdvanced();
      });

      expect(result.current.filters.goalMin).toBe("");
      expect(result.current.filters.goalMax).toBe("");
      expect(result.current.filters.dateFrom).toBe("");
      expect(result.current.filters.dateTo).toBe("");
    });

    it("removes all advanced filter params and the page param from the URL", () => {
      mockSearchParams.set("goalMin", "1000");
      mockSearchParams.set("goalMax", "50000");
      mockSearchParams.set("dateFrom", "2024-01-01");
      mockSearchParams.set("dateTo", "2024-12-31");
      mockSearchParams.set("page", "3");

      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.clearAdvanced();
      });

      const url = lastReplaceUrl(mockRouter);
      expect(url.searchParams.has("goalMin")).toBe(false);
      expect(url.searchParams.has("goalMax")).toBe(false);
      expect(url.searchParams.has("dateFrom")).toBe(false);
      expect(url.searchParams.has("dateTo")).toBe(false);
      expect(url.searchParams.has("page")).toBe(false);
    });

    it("leaves non-advanced filters (filter, sort, category, q) untouched in the URL", () => {
      mockSearchParams.set("filter", "active");
      mockSearchParams.set("sort", "popular");
      mockSearchParams.set("category", "tech");
      mockSearchParams.set("q", "education");
      mockSearchParams.set("goalMin", "1000");

      const { result } = renderHook(() => useCampaignFilters());

      act(() => {
        result.current.clearAdvanced();
      });

      const url = lastReplaceUrl(mockRouter);
      expect(url.searchParams.get("filter")).toBe("active");
      expect(url.searchParams.get("sort")).toBe("popular");
      expect(url.searchParams.get("category")).toBe("tech");
      expect(url.searchParams.get("q")).toBe("education");
    });
  });

  describe("malformed/invalid URL query params", () => {
    it("falls back to page 1 when the 'page' param is non-numeric", () => {
      mockSearchParams.set("page", "not-a-number");

      const { result } = renderHook(() => useCampaignFilters());

      expect(result.current.filters.page).toBe(1);
      expect(Number.isNaN(result.current.filters.page)).toBe(false);
    });

    it("falls back to page 1 when the 'page' param is negative or zero", () => {
      mockSearchParams.set("page", "-5");
      const { result: negative } = renderHook(() => useCampaignFilters());
      expect(negative.current.filters.page).toBe(1);

      mockSearchParams.set("page", "0");
      const { result: zero } = renderHook(() => useCampaignFilters());
      expect(zero.current.filters.page).toBe(1);
    });

    it("falls back to page 1 when the 'page' param is empty", () => {
      mockSearchParams.set("page", "");

      const { result } = renderHook(() => useCampaignFilters());

      expect(result.current.filters.page).toBe(1);
    });

    it("does not crash and returns null for a non-numeric 'goalMin'/'goalMax'", () => {
      mockSearchParams.set("goalMin", "not-a-number");
      mockSearchParams.set("goalMax", "also-bad");

      const { result } = renderHook(() => useCampaignFilters());

      expect(result.current.activeGoalMin).toBeNull();
      expect(result.current.activeGoalMax).toBeNull();
      expect(result.current.hasAdvanced).toBe(false);
    });

    it("does not crash and passes through an unrecognized 'filter'/'sort' value without throwing", () => {
      mockSearchParams.set("filter", "not-a-real-tab");
      mockSearchParams.set("sort", "not-a-real-sort");

      expect(() => renderHook(() => useCampaignFilters())).not.toThrow();
    });

    it("does not crash when required params are entirely absent", () => {
      expect(() => renderHook(() => useCampaignFilters())).not.toThrow();
    });
  });
});
