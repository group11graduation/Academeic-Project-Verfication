"""Re-export so legacy imports (`screenshot_similarity`) stay stable."""

from app.services.image_analysis import analyze_screenshot_similarity

__all__ = ["analyze_screenshot_similarity"]
