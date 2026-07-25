import { renderHook, act } from "@testing-library/react";
import { useContractError } from "./useContractError";

describe("useContractError", () => {
  it("should initialize with no error", () => {
    const { result } = renderHook(() => useContractError());

    expect(result.current.error.isVisible).toBe(false);
    expect(result.current.error.message).toBe("");
    expect(result.current.error.code).toBeNull();
  });

  it("should handle contract error with code", () => {
    const { result } = renderHook(() => useContractError());

    act(() => {
      result.current.handleError("Contract error: code 32");
    });

    expect(result.current.error.isVisible).toBe(true);
    expect(result.current.error.code).toBe(32);
    expect(result.current.error.message).toContain("Insufficient");
  });

  it("should handle unknown error gracefully", () => {
    const { result } = renderHook(() => useContractError());

    act(() => {
      result.current.handleError("Network timeout");
    });

    expect(result.current.error.isVisible).toBe(true);
    expect(result.current.error.code).toBeNull();
    expect(result.current.error.message).toBe("Network timeout");
  });

  it("should clear error state", () => {
    const { result } = renderHook(() => useContractError());

    act(() => {
      result.current.handleError("error: code 2");
    });

    expect(result.current.error.isVisible).toBe(true);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error.isVisible).toBe(false);
    expect(result.current.error.message).toBe("");
    expect(result.current.error.code).toBeNull();
  });

  it("should handle Error objects", () => {
    const { result } = renderHook(() => useContractError());
    const error = new Error("Soroban error: code 9");

    act(() => {
      result.current.handleError(error);
    });

    expect(result.current.error.isVisible).toBe(true);
    expect(result.current.error.code).toBe(9);
    expect(result.current.error.message).toContain("minimum");
  });

  it("should overwrite previous error", () => {
    const { result } = renderHook(() => useContractError());

    act(() => {
      result.current.handleError("error: code 2");
    });

    expect(result.current.error.code).toBe(2);

    act(() => {
      result.current.handleError("error: code 32");
    });

    expect(result.current.error.code).toBe(32);
    expect(result.current.error.message).toContain("Insufficient");
  });
});
