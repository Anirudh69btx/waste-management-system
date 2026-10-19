import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageUploader } from "../components/ImageUploader";

describe("ImageUploader", () => {
  const createMockJpeg = (name = "photo.jpg", size = 1024) => {
    const bytes = new Uint8Array(12);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    const file = new File([bytes], name, { type: "image/jpeg" });
    if (size !== 1024) {
      Object.defineProperty(file, "size", { value: size });
    }
    return file;
  };

  const createFakeImage = (name = "fake.jpg") => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    return new File([bytes], name, { type: "image/jpeg" });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn();
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    }
    vi.spyOn(window.URL, "createObjectURL").mockImplementation((f: any) => `blob:mock-url/${f?.name ?? "file"}`);
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("adds valid JPEG file and invokes onChange", async () => {
    const handleChange = vi.fn();
    const { container } = render(<ImageUploader value={[]} onChange={handleChange} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const validJpeg = createMockJpeg("valid.jpg");
    fireEvent.change(input, { target: { files: [validJpeg] } });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith([validJpeg]);
    });
  });

  it("rejects oversized file and displays error message", async () => {
    const handleChange = vi.fn();
    const { container } = render(<ImageUploader value={[]} onChange={handleChange} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const oversizedFile = createMockJpeg("large.jpg", 11 * 1024 * 1024);

    fireEvent.change(input, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/exceeds 10MB limit/i)).toBeInTheDocument();
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  it("rejects fake MIME image where bytes do not match header magic numbers", async () => {
    const handleChange = vi.fn();
    const { container } = render(<ImageUploader value={[]} onChange={handleChange} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = createFakeImage("bad.jpg");

    fireEvent.change(input, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/not a valid JPEG, PNG, or WebP image/i)).toBeInTheDocument();
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  it("removes thumbnail, calls onChange with filtered list, and revokes object URL", async () => {
    const file = createMockJpeg("thumb.jpg");
    const handleChange = vi.fn();

    render(<ImageUploader value={[file]} onChange={handleChange} />);

    const removeBtn = screen.getByRole("button", { name: `Remove ${file.name}` });
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);

    expect(window.URL.revokeObjectURL).toHaveBeenCalled();
    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
