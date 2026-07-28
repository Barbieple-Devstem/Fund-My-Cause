import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaStep } from "./MediaStep";
import { INITIAL, type CampaignFormData } from "../types";

// The uploaders own file-picking, cropping and IPFS pinning; none of that is
// what this step is responsible for. Stub them down to the callbacks MediaStep
// wires up so the assertions below are about MediaStep's own behaviour.
jest.mock("@/components/ui/ImageUploader", () => ({
  ImageUploader: ({
    onUpload,
    onClear,
  }: {
    onUpload: (uri: string) => void;
    onClear: () => void;
  }) => (
    <div>
      <button onClick={() => onUpload("ipfs://image")}>upload-image</button>
      <button onClick={onClear}>clear-image</button>
    </div>
  ),
}));

jest.mock("@/components/ui/VideoUploader", () => ({
  VideoUploader: ({
    onUpload,
    onError,
  }: {
    onUpload: (url: string) => void;
    onError?: (error: string) => void;
  }) => (
    <div>
      <button onClick={() => onUpload("https://cdn.example.com/v.mp4")}>
        upload-video
      </button>
      <button onClick={() => onError?.("File too large")}>fail-video</button>
    </div>
  ),
}));

const mockLogError = jest.fn();
jest.mock("@/lib/errorLogger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const URL_INPUT = /Or enter a video URL directly:/i;

function renderStep(overrides: Partial<CampaignFormData> = {}) {
  const set = jest.fn();
  render(<MediaStep data={{ ...INITIAL, ...overrides }} set={set} />);
  return { set };
}

beforeEach(() => {
  mockLogError.mockClear();
});

describe("MediaStep", () => {
  // ── Image ──────────────────────────────────────────────────────────────────

  it("stores an uploaded image URI", async () => {
    const { set } = renderStep();
    await userEvent.click(screen.getByText("upload-image"));
    expect(set).toHaveBeenCalledWith("imageUrl", "ipfs://image");
  });

  it("clears the stored image URI", async () => {
    const { set } = renderStep({ imageUrl: "ipfs://image" });
    await userEvent.click(screen.getByText("clear-image"));
    expect(set).toHaveBeenCalledWith("imageUrl", "");
  });

  // ── Video upload ───────────────────────────────────────────────────────────

  it("stores an uploaded video URL", async () => {
    const { set } = renderStep();
    await userEvent.click(screen.getByText("upload-video"));
    expect(set).toHaveBeenCalledWith(
      "videoUrl",
      "https://cdn.example.com/v.mp4",
    );
  });

  it("surfaces an upload failure to the user", async () => {
    renderStep();
    await userEvent.click(screen.getByText("fail-video"));
    expect(screen.getByRole("alert")).toHaveTextContent("File too large");
  });

  it("routes an upload failure to the structured logger, not the console", async () => {
    renderStep();
    await userEvent.click(screen.getByText("fail-video"));
    expect(mockLogError).toHaveBeenCalledWith("File too large");
  });

  // ── Video URL entry ────────────────────────────────────────────────────────

  it("offers direct URL entry when no video is set", () => {
    renderStep();
    expect(screen.getByText(URL_INPUT)).toBeInTheDocument();
  });

  it("hides direct URL entry once a video is set", () => {
    renderStep({ videoUrl: "https://example.com/v.mp4" });
    expect(screen.queryByText(URL_INPUT)).not.toBeInTheDocument();
  });

  it("stores a manually typed video URL", async () => {
    const { set } = renderStep();
    await userEvent.type(
      screen.getByPlaceholderText(/youtube\.com\/watch/i),
      "h",
    );
    expect(set).toHaveBeenCalledWith("videoUrl", "h");
  });

  // ── Validation feedback ────────────────────────────────────────────────────

  it("shows no feedback when the video field is empty — video is optional", () => {
    renderStep();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ Video URL is valid")).not.toBeInTheDocument();
  });

  it("confirms a valid https video URL", () => {
    renderStep({ videoUrl: "https://example.com/v.mp4" });
    expect(screen.getByText("✓ Video URL is valid")).toBeInTheDocument();
  });

  it("rejects a non-https video URL", () => {
    renderStep({ videoUrl: "ftp://example.com/v.mp4" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid URL starting with https://",
    );
    expect(screen.queryByText("✓ Video URL is valid")).not.toBeInTheDocument();
  });
});
