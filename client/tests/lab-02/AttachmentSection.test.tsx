import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentSection } from "../../src/components/AttachmentSection";
import type { AttachmentMeta } from "../../src/api";

const activeAttachment: AttachmentMeta = {
  id: 1,
  ticketId: 1,
  originalName: "photo.png",
  mimeType: "image/png",
  sizeBytes: 1024,
  uploadedAt: "2026-08-20T09:00:00.000Z",
  removedAt: null,
  removedReason: null,
};

const removedAttachment: AttachmentMeta = {
  id: 2,
  ticketId: 1,
  originalName: "old-screenshot.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  uploadedAt: "2026-08-19T09:00:00.000Z",
  removedAt: "2026-08-20T10:00:00.000Z",
  removedReason: "Wrong screenshot, replaced by the correct one",
};

describe("AttachmentSection", () => {
  // UI-13 - AC-20
  it("renders no download or preview control for a removed attachment", () => {
    render(
      <AttachmentSection
        attachments={[removedAttachment]}
        uploading={false}
        uploadError={null}
        onAddFile={vi.fn()}
        onDownload={vi.fn()}
        onRemoveRequest={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText(/wrong screenshot, replaced by the correct one/i)).toBeInTheDocument();
  });

  it("calls onDownload and onRemoveRequest for an active attachment", async () => {
    const onDownload = vi.fn();
    const onRemoveRequest = vi.fn();
    const user = userEvent.setup();

    render(
      <AttachmentSection
        attachments={[activeAttachment]}
        uploading={false}
        uploadError={null}
        onAddFile={vi.fn()}
        onDownload={onDownload}
        onRemoveRequest={onRemoveRequest}
      />
    );

    await user.click(screen.getByRole("button", { name: /download/i }));
    expect(onDownload).toHaveBeenCalledWith(activeAttachment);

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(onRemoveRequest).toHaveBeenCalledWith(activeAttachment);
  });

  // UI-14 - AC-17
  it("disables Add Attachment once 5 active attachments already exist", () => {
    const fiveActive = Array.from({ length: 5 }, (_, i) => ({ ...activeAttachment, id: i + 1 }));

    render(
      <AttachmentSection
        attachments={fiveActive}
        uploading={false}
        uploadError={null}
        onAddFile={vi.fn()}
        onDownload={vi.fn()}
        onRemoveRequest={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /add attachment/i })).toBeDisabled();
    expect(screen.getByText(/maximum of 5 active attachments/i)).toBeInTheDocument();
  });

  it("shows the upload error banner when one is provided", () => {
    render(
      <AttachmentSection
        attachments={[]}
        uploading={false}
        uploadError="File exceeds the 5 MB size limit."
        onAddFile={vi.fn()}
        onDownload={vi.fn()}
        onRemoveRequest={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/exceeds the 5 mb size limit/i);
  });
});
