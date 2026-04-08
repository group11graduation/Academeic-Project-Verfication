"""Pydantic request/response models — API contracts for FastAPI and Node orchestration."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --- Health ---
class HealthResponse(BaseModel):
    ok: bool = True
    service: str = Field(..., description="Service identifier")


# --- Proposal analysis (Node: POST /analyze/proposal) ---
class ProposalPeerItem(BaseModel):
    """One comparable proposal or legacy project document."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Mongo ObjectId string")
    text: str = Field(..., description="Flattened title + description + features")


class ProposalAnalyzeIn(BaseModel):
    """
    Input from Node `analyzeProposalPayload`.

    `text`: current proposal embedding string.
    `same_semester`: other proposals in the same cohort (conflict detection).
    `legacy`: prior semester / year projects (previous-semester match).
    """

    model_config = ConfigDict(extra="ignore")

    text: str = Field(..., min_length=1)
    same_semester: list[ProposalPeerItem] = Field(default_factory=list)
    legacy: list[ProposalPeerItem] = Field(default_factory=list)


class ProposalAnalyzeOut(BaseModel):
    """Stable JSON shape consumed by `proposalWorkflow.service.js`."""

    same_semester_max: float = Field(..., ge=0.0, le=1.0)
    legacy_max: float = Field(..., ge=0.0, le=1.0)
    matched_proposal_id: str | None = None
    matched_legacy_id: str | None = None
    verdict: Literal["reject_same_semester", "warn_previous_semester", "ok"]
    summary: str = ""
    backend: Literal["sentence_transformers", "tfidf"] = "sentence_transformers"


# --- Code similarity (optional Node endpoint) ---
class CodeReferenceItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = ""
    text: str = Field(..., description="Source code text")
    language: str = Field(default="python", description="tree-sitter language id, e.g. python, javascript")


class CodeAnalyzeIn(BaseModel):
    """Compare one submission snippet against reference implementations."""

    model_config = ConfigDict(extra="ignore")

    source: str = Field(..., min_length=1)
    language: str = Field(default="python")
    references: list[CodeReferenceItem] = Field(default_factory=list)


class CodeAnalyzeOut(BaseModel):
    max_similarity: float = Field(..., ge=0.0, le=1.0)
    matched_id: str | None = None
    method: Literal["tree_sitter_tfidf", "codebert", "fallback_char"] = "tree_sitter_tfidf"
    warning: bool = Field(False, description="True if max_similarity >= threshold")
    detail: str = ""


# --- Screenshot / UI duplicate warning ---
class ScreenshotAnalyzeIn(BaseModel):
    """
    Perceptual hash compare: current screenshot vs stored hashes from prior work.

    `reference_hashes`: hex strings from ImageHash (e.g. phash) previously persisted.
    """

    model_config = ConfigDict(extra="ignore")

    image_base64: str = Field(..., min_length=10, description="Raw base64 or data URL")
    reference_hashes: list[str] = Field(default_factory=list, description="Hex phash strings")
    hamming_threshold: int = Field(
        10,
        ge=0,
        le=64,
        description="Warn if smallest Hamming distance to any reference is at or below this (more similar = lower).",
    )


class ScreenshotAnalyzeOut(BaseModel):
    phash_hex: str = Field(..., description="Current image perceptual hash (hex)")
    best_match_hash: str | None = None
    min_hamming_distance: int | None = None
    warning: bool = False
    message: str = ""
