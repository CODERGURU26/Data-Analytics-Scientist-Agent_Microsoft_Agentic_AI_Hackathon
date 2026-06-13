from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from ..models import AnalysisResult


def build_report_pdf(result: AnalysisResult, output_path: Path) -> Path:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InsightTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=colors.HexColor("#0A0D12"),
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        "InsightBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1E2631"),
    )
    heading_style = ParagraphStyle(
        "InsightHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=colors.HexColor("#C6A86A"),
        spaceBefore=8,
        spaceAfter=4,
    )

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    story = [
        Paragraph("InsightAI Executive Report", title_style),
        Paragraph(result.executive_report.executive_summary, body_style),
        Spacer(1, 12),
        Paragraph("Dataset Overview", heading_style),
        Paragraph(result.executive_report.dataset_overview, body_style),
        Paragraph("Health Score", heading_style),
        Paragraph(str(result.data_quality.dataset_health_score), body_style),
        Paragraph("Key Findings", heading_style),
    ]
    story.extend(Paragraph(f"• {item}", body_style) for item in result.executive_report.key_findings)
    story.append(Paragraph("Business Opportunities", heading_style))
    story.extend(
        Paragraph(f"• {item}", body_style) for item in result.executive_report.business_opportunities
    )
    story.append(Paragraph("Risk Factors", heading_style))
    story.extend(Paragraph(f"• {item}", body_style) for item in result.executive_report.risk_factors)
    story.append(Paragraph("ML Strategy", heading_style))
    story.append(Paragraph(result.executive_report.ml_strategy, body_style))

    doc.build(story)
    return output_path
