import { renderHook, act } from "@testing-library/react";
import { useCampaignFilters } from "./useCampaignFilters";
import { useRouter, useSearchParams } from "next/navigation";

jest.mock("next/navigation");

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

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useCampaignFilters());

    expect(result.current.filters.filter).toBe("all");
    expect(result.current.filters.sort).toBe("recent");
    expect(result.current.filters.query).toBe("");
    expect(result.current.filters.category).toBe("");
    expect(result.current.filters.page).toBe(1);
  });

  it("should read filter state from URL search params", () => {
    mockSearchParams.set("filter", "active");
    mockSearchParams.set("sort", "popular");
    mockSearchParams.set("q", "education");
    mockSearchParams.set("category", "tech");
    mockSearchParams.set("page", "2");

    const { result } = renderHook(() => useCampaignFilters());

    expect(result.current.filters.filter).toBe("active");
    expect(result.current.filters.sort).toBe("popular");
    expect(result.current.filters.query).toBe("education");
    expect(result.current.filters.category).toBe("tech");
    expect(result.current.filters.page).toBe(2);
  });

  it("should update query param and reset page", () => {
    const { result } = renderHook(() => useCampaignFilters());

    act(() => {
      result.current.setParam("q", "test");
    });

    expect(mockRouter.replace).toHaveBeenCalled();
  });

  it("should delete filter param when set to 'all'", () => {
    const { result } = renderHook(() => useCampaignFilters());

    act(() => {
      result.current.setParam("filter", "all");
    });

    expect(mockRouter.replace).toHaveBeenCalled();
  });

  it("should delete sort param when set to 'recent'", () => {
    const { result } = renderHook(() => useCampaignFilters());

    act(() => {
      result.current.setParam("sort", "recent");
    });

    expect(mockRouter.replace).toHaveBeenCalled();
  });

  it("should handle advanced filter application", () => {
    const { result } = renderHook(() => useCampaignFilters());

    act(() => {
      result.current.setGoalMin("1000");
      result.current.setGoalMax("50000");
    });

    act(() => {
      result.current.applyAdvanced();
    });

    expect(mockRouter.replace).toHaveBeenCalled();
  });

  it("should clear advanced filters", () => {
    mockSearchParams.set("goalMin", "1000");
    mockSearchParams.set("goalMax", "50000");

    const { result } = renderHook(() => useCampaignFilters());

    act(() => {
      result.current.clearAdvanced();
    });

    expect(mockRouter.replace).toHaveBeenCalled();
    expect(result.current.filters.goalMin).toBe("");
    expect(result.current.filters.goalMax).toBe("");
  });

  it("should detect when advanced filters are active", () => {
    mockSearchParams.set("goalMin", "1000");

    const { result } = renderHook(() => useCampaignFilters());

    expect(result.current.hasAdvanced).toBe(true);
  });

  it("should sync input value with query param after debounce", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useCampaignFilters());

    act(() => {
      result.current.setInputValue("test");
    });

    jest.advanceTimersByTime(300);

    expect(mockRouter.replace).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("should toggle advanced filter panel", () => {
    const { result } = renderHook(() => useCampaignFilters());

    expect(result.current.showAdvanced).toBe(false);

    act(() => {
      result.current.setShowAdvanced(true);
    });

    expect(result.current.showAdvanced).toBe(true);
  });

  it("should parse advanced filter values from URL", () => {
    mockSearchParams.set("goalMin", "1000");
    mockSearchParams.set("goalMax", "50000");
    mockSearchParams.set("dateFrom", "2024-01-01");
    mockSearchParams.set("dateTo", "2024-12-31");

    const { result } = renderHook(() => useCampaignFilters());

    expect(result.current.activeGoalMin).toBe(1000);
    expect(result.current.activeGoalMax).toBe(50000);
    expect(result.current.activeDateFrom).toBe("2024-01-01");
    expect(result.current.activeDateTo).toBe("2024-12-31");
  });
});
