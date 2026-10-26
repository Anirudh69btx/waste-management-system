import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as aiApi from "@/api/ai";
import type { WasteAssessment } from "@/api/types";
import { AIAssessmentCard } from "../components/AIAssessmentCard";

vi.mock("@/api/ai", () => ({
  getAssessment: vi.fn(),
  retryAssessment: vi.fn(),
}));

const sampleAssessment: WasteAssessment = {
  id: "assess-1",
  intake_id: "intake-1",
  detected_category: "PLASTIC_PET",
  confidence_score: 0.94,
  estimated_purity_percentage: 96.5,
  contamination_detected: false,
  contamination_details: [],
  suggested_purity_grade: "A",
  model_version: "waste-classifier-v1.2",
  latency_ms: 320,
  created_at: new Date().toISOString(),
};

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    qc,
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
  };
}

describe("AIAssessmentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows AI analyzing skeleton then renders category, confidence, and grade when data resolves", async () => {
    vi.mocked(aiApi.getAssessment)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sampleAssessment);

    const { qc } = renderWithQuery(
      <AIAssessmentCard intakeId="intake-1" variant="full" />
    );

    expect(await screen.findByText("AI analyzing...")).toBeInTheDocument();

    await qc.invalidateQueries({ queryKey: ["ai-assessment", "intake-1"] });

    await waitFor(() => {
      expect(screen.getByText("PET Plastics (Grade 1)")).toBeInTheDocument();
    });
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByText("Grade A")).toBeInTheDocument();
    expect(screen.getByText("96.5%")).toBeInTheDocument();
  });

  it("shows Low confidence warning text when confidence_score is below 0.70", async () => {
    vi.mocked(aiApi.getAssessment).mockResolvedValue({
      ...sampleAssessment,
      confidence_score: 0.62,
    });

    renderWithQuery(<AIAssessmentCard intakeId="intake-low" variant="full" />);

    expect(
      await screen.findByText("Low confidence — review")
    ).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("shows contamination banner and contamination_details pills when contamination_detected is true", async () => {
    vi.mocked(aiApi.getAssessment).mockResolvedValue({
      ...sampleAssessment,
      contamination_detected: true,
      contamination_details: ["labels", "oil residue"],
    });

    renderWithQuery(
      <AIAssessmentCard intakeId="intake-contam" variant="full" />
    );

    expect(
      await screen.findByText("Contamination detected")
    ).toBeInTheDocument();
    expect(screen.getByText("labels")).toBeInTheDocument();
    expect(screen.getByText("oil residue")).toBeInTheDocument();
  });
});
