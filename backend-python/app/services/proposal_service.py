"""
Proposal comparison orchestration: cohort filtering before embedding work.

Router → controller → **proposal_service** → proposal_semantic / preprocessing.

Keeps peer lists small so SBERT + FAISS operate on a relevant subset only.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.models.schemas import ProposalAnalyzeIn, ProposalPeerItem

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def proposal_peer_matches_filters(peer: ProposalPeerItem, payload: ProposalAnalyzeIn) -> bool:
    """
    If submission-side filters are set, drop peers that contradict metadata.

    Peers without metadata fields remain eligible (backward compatible with Node payloads
    that only send id + text).
    """
    fs = _norm(payload.filter_subject)
    if fs and peer.subject is not None and _norm(peer.subject) and _norm(peer.subject) != fs:
        return False

    fat = _norm(payload.filter_assignment_type)
    if fat and peer.assignment_type is not None and _norm(peer.assignment_type) and _norm(peer.assignment_type) != fat:
        return False

    return True


def filter_legacy_previous_semesters(peers: list[ProposalPeerItem], payload: ProposalAnalyzeIn) -> list[ProposalPeerItem]:
    """Exclude legacy rows tagged as the current cohort when legacy_previous_semesters_only is enabled."""
    if not payload.legacy_previous_semesters_only:
        return peers
    cur = _norm(payload.submission_semester)
    if not cur:
        logger.warning("legacy_previous_semesters_only set but submission_semester empty; skipping legacy semester filter")
        return peers

    kept: list[ProposalPeerItem] = []
    for p in peers:
        ps = _norm(p.semester)
        if ps and ps == cur:
            continue
        kept.append(p)
    return kept


def filter_proposal_peers(payload: ProposalAnalyzeIn) -> tuple[list[ProposalPeerItem], list[ProposalPeerItem]]:
    """Apply subject / assignment / legacy-semester filters before similarity."""
    same_f = [p for p in payload.same_semester if proposal_peer_matches_filters(p, payload)]
    leg_raw = [p for p in payload.legacy if proposal_peer_matches_filters(p, payload)]
    leg_f = filter_legacy_previous_semesters(leg_raw, payload)

    dropped_same = len(payload.same_semester) - len(same_f)
    dropped_leg = len(payload.legacy) - len(leg_f)
    if dropped_same or dropped_leg:
        logger.info(
            "Filtered proposal peers: same_semester %s→%s, legacy %s→%s",
            len(payload.same_semester),
            len(same_f),
            len(payload.legacy),
            len(leg_f),
        )
    return same_f, leg_f
