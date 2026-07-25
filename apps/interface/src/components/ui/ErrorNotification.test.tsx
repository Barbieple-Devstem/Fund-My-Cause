import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorNotification } from "./ErrorNotification";

describe("ErrorNotification", () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("should not render when not visible", () => {
    const { container } = render(
      <ErrorNotification
        isVisible={false}
        message="Test error"
        onClose={jest.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render error message when visible", () => {
    render(
      <ErrorNotification
        isVisible={true}
        message="Test error message"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Test error message")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should display error code when provided", () => {
    render(
      <ErrorNotification
        isVisible={true}
        message="Insufficient funds"
        code={32}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Error code: 32")).toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    const handleClose = jest.fn();
    render(
      <ErrorNotification
        isVisible={true}
        message="Test error"
        onClose={handleClose}
      />,
    );

    const closeButton = screen.getByLabelText("Close error notification");
    await userEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalled();
  });

  it("should auto-dismiss after 8 seconds", () => {
    const handleClose = jest.fn();
    render(
      <ErrorNotification
        isVisible={true}
        message="Test error"
        onClose={handleClose}
      />,
    );

    expect(handleClose).not.toHaveBeenCalled();

    jest.advanceTimersByTime(8000);

    expect(handleClose).toHaveBeenCalled();
  });

  it("should clear timeout when component unmounts", () => {
    const handleClose = jest.fn();
    const { unmount } = render(
      <ErrorNotification
        isVisible={true}
        message="Test error"
        onClose={handleClose}
      />,
    );

    unmount();
    jest.advanceTimersByTime(8000);

    expect(handleClose).not.toHaveBeenCalled();
  });

  it("should have proper accessibility attributes", () => {
    render(
      <ErrorNotification
        isVisible={true}
        message="Test error"
        onClose={jest.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });

  it("should work with both known and unknown error codes", () => {
    const { rerender } = render(
      <ErrorNotification
        isVisible={true}
        message="Known error"
        code={2}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Error code: 2")).toBeInTheDocument();

    rerender(
      <ErrorNotification
        isVisible={true}
        message="Unknown error"
        code={9999}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Error code: 9999")).toBeInTheDocument();
  });
});
