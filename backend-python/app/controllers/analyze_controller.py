"""
Analyze orchestration: keeps routers free of business branching.

Flow: router → analyze_controller → services → preprocessing.
"""

from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from fastapi import BackgroundTasks

from app.models.schemas import (
    AnalysisJobStatus,
    CodeAnalyzeIn,
    CodeAnalyzeOut,
    FullAnalyzeIn,
    FullAnalyzeOut,
    ProposalAnalyzeIn,
    ProposalAnalyzeOut,
    ProposalJobAccepted,
    ScreenshotAnalyzeIn,
    ScreenshotAnalyzeOut,
)
from app.services import analysis_job_store
from app.services.code_analysis import analyze_code_similarity
from app.services.image_analysis import analyze_screenshot_similarity
from app.services.proposal_semantic import analyze_proposal_semantic

logger = logging.getLogger(__name__)


def _validate_completed(kind: str, raw: dict[str, Any]) -> Any:
    if kind == "proposal":
        return ProposalAnalyzeOut.model_validate(raw)
    if kind == "code":
        return CodeAnalyzeOut.model_validate(raw)
    if kind == "screenshot":
        return ScreenshotAnalyzeOut.model_validate(raw)
    if kind == "full":
        return FullAnalyzeOut.model_validate(raw)
    return raw


def analyze_proposal_sync(body: ProposalAnalyzeIn) -> dict[str, Any]:
    return analyze_proposal_semantic(body)


def analyze_proposal_async(body: ProposalAnalyzeIn, background_tasks: BackgroundTasks) -> ProposalJobAccepted:
    jid = analysis_job_store.create_job("proposal")
    payload = body.model_dump(mode="json")

    def _run() -> None:
        try:
            p = ProposalAnalyzeIn.model_validate(payload)
            analysis_job_store.mark_completed(jid, analyze_proposal_semantic(p))
        except Exception as e:
            logger.exception("Async proposal job %s failed", jid)
            analysis_job_store.mark_failed(jid, str(e))

    background_tasks.add_task(_run)
    return ProposalJobAccepted(job_id=jid)


def analyze_code_sync(body: CodeAnalyzeIn) -> dict[str, Any]:
    return analyze_code_similarity(body)


def analyze_code_async(body: CodeAnalyzeIn, background_tasks: BackgroundTasks) -> ProposalJobAccepted:
    jid = analysis_job_store.create_job("code")
    payload = body.model_dump(mode="json")

    def _run() -> None:
        try:
            p = CodeAnalyzeIn.model_validate(payload)
            analysis_job_store.mark_completed(jid, analyze_code_similarity(p))
        except Exception as e:
            logger.exception("Async code job %s failed", jid)
            analysis_job_store.mark_failed(jid, str(e))

    background_tasks.add_task(_run)
    return ProposalJobAccepted(job_id=jid)


def analyze_screenshot_sync(body: ScreenshotAnalyzeIn) -> dict[str, Any]:
    return analyze_screenshot_similarity(body)


def analyze_screenshot_async(body: ScreenshotAnalyzeIn, background_tasks: BackgroundTasks) -> ProposalJobAccepted:
    jid = analysis_job_store.create_job("screenshot")
    payload = body.model_dump(mode="json")

    def _run() -> None:
        try:
            p = ScreenshotAnalyzeIn.model_validate(payload)
            analysis_job_store.mark_completed(jid, analyze_screenshot_similarity(p))
        except Exception as e:
            logger.exception("Async screenshot job %s failed", jid)
            analysis_job_store.mark_failed(jid, str(e))

    background_tasks.add_task(_run)
    return ProposalJobAccepted(job_id=jid)


async def analyze_full(body: FullAnalyzeIn) -> FullAnalyzeOut:
    """Run proposal / code / screenshot concurrently via thread offload (asyncio.gather)."""
    timings_ms: dict[str, float] = {}

    async def _timed(label: str, fn, *args):
        t0 = time.perf_counter()
        out = await asyncio.to_thread(fn, *args)
        timings_ms[f"{label}_ms"] = (time.perf_counter() - t0) * 1000
        return label, out

    tasks = []
    if body.proposal:
        tasks.append(_timed("proposal", analyze_proposal_semantic, body.proposal))
    if body.code:
        tasks.append(_timed("code", analyze_code_similarity, body.code))
    if body.screenshot:
        tasks.append(_timed("screenshot", analyze_screenshot_similarity, body.screenshot))

    proposal_out = code_out = shot_out = None
    if tasks:
        for label, raw in await asyncio.gather(*tasks):
            if label == "proposal":
                proposal_out = ProposalAnalyzeOut.model_validate(raw)
            elif label == "code":
                code_out = CodeAnalyzeOut.model_validate(raw)
            elif label == "screenshot":
                shot_out = ScreenshotAnalyzeOut.model_validate(raw)

    timings_ms["wall_total_ms"] = sum(v for k, v in timings_ms.items() if k.endswith("_ms"))
    logger.info("analyze_full async timings_ms=%s", timings_ms)
    return FullAnalyzeOut(proposal=proposal_out, code=code_out, screenshot=shot_out, timings_ms=timings_ms)


def _run_full_job_parallel(payload: dict[str, Any], jid: str) -> None:
    """Background worker: threads parallelize independent SBERT / AST / phash work."""
    try:
        body = FullAnalyzeIn.model_validate(payload)
        timings_ms: dict[str, float] = {}
        proposal_out = code_out = shot_out = None

        jobs: list[tuple[str, Any, Any]] = []
        if body.proposal:
            jobs.append(("proposal", analyze_proposal_semantic, body.proposal))
        if body.code:
            jobs.append(("code", analyze_code_similarity, body.code))
        if body.screenshot:
            jobs.append(("screenshot", analyze_screenshot_similarity, body.screenshot))

        def _one(label: str, fn: Any, arg: Any):
            t0 = time.perf_counter()
            r = fn(arg)
            return label, r, (time.perf_counter() - t0) * 1000

        if jobs:
            with ThreadPoolExecutor(max_workers=min(3, len(jobs))) as pool:
                futures = [pool.submit(_one, lbl, fn, arg) for lbl, fn, arg in jobs]
                for fut in as_completed(futures):
                    label, raw, ms = fut.result()
                    timings_ms[f"{label}_ms"] = ms
                    if label == "proposal":
                        proposal_out = ProposalAnalyzeOut.model_validate(raw)
                    elif label == "code":
                        code_out = CodeAnalyzeOut.model_validate(raw)
                    elif label == "screenshot":
                        shot_out = ScreenshotAnalyzeOut.model_validate(raw)

        timings_ms["wall_total_ms"] = sum(v for k, v in timings_ms.items() if k.endswith("_ms"))
        result = FullAnalyzeOut(
            proposal=proposal_out, code=code_out, screenshot=shot_out, timings_ms=timings_ms
        )
        analysis_job_store.mark_completed(jid, result.model_dump(mode="json"))
        logger.info("analyze_full job %s timings_ms=%s", jid, timings_ms)
    except Exception as e:
        logger.exception("Async full job %s failed", jid)
        analysis_job_store.mark_failed(jid, str(e))


def analyze_full_async_submit(body: FullAnalyzeIn, background_tasks: BackgroundTasks) -> ProposalJobAccepted:
    jid = analysis_job_store.create_job("full")
    background_tasks.add_task(_run_full_job_parallel, body.model_dump(mode="json"), jid)
    return ProposalJobAccepted(job_id=jid)


def get_analysis_result(job_id: str) -> AnalysisJobStatus:
    row = analysis_job_store.get_job(job_id)
    if not row:
        return AnalysisJobStatus(status="not_found", job_kind=None, result=None, error=None)
    kind = row.get("kind")
    if row["status"] == "processing":
        return AnalysisJobStatus(status="processing", job_kind=kind, result=None, error=None)
    if row["status"] == "failed":
        return AnalysisJobStatus(status="failed", job_kind=kind, result=None, error=row.get("error"))
    raw = row.get("result") or {}
    validated = _validate_completed(kind, raw)
    return AnalysisJobStatus(status="completed", job_kind=kind, result=validated, error=None)
