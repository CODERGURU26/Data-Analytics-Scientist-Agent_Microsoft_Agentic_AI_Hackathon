from __future__ import annotations

import hashlib
import uuid
import logging
from datetime import datetime
from pathlib import Path
from time import perf_counter

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import Settings, get_settings
from .models import AnalysisLookupResponse, AnalysisStatus, AnalyzeRequest
from .services.analysis_engine import AnalysisEngine
from .services.azure_openai import AzureOpenAIService
from .storage import analysis_store

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _mask(value: str | None, head: int = 4, tail: int = 4) -> str:
    if not value:
        return "missing"
    if len(value) <= head + tail:
        return "*" * len(value)
    return f"{value[:head]}...{value[-tail:]}"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    azure_service = AzureOpenAIService(settings)

    logger.info(
        "Azure config loaded endpoint=%s key=%s deployment=%s api_version=%s",
        _mask(settings.azure_openai_endpoint),
        "loaded" if settings.azure_openai_api_key else "missing",
        _mask(settings.azure_openai_deployment),
        _mask(settings.azure_openai_api_version),
    )

    @app.get("/health")
    async def healthcheck() -> dict[str, str]:
        azure_configured = all(
            [
                settings.azure_openai_endpoint,
                settings.azure_openai_api_key,
                settings.azure_openai_deployment,
            ]
        )
        return {
            "status": "ok",
            "mode": "production" if azure_configured else "demo",
            "azure_openai_configured": str(bool(azure_configured)).lower(),
            "backend_configured": "true",
        }

    @app.get(f"{settings.api_prefix}/health/azure")
    async def azure_health() -> dict[str, object]:
        diagnostics = azure_service.diagnostics()
        payload: dict[str, object] = {
            "endpoint_loaded": diagnostics.endpoint_loaded,
            "api_key_loaded": diagnostics.api_key_loaded,
            "deployment_loaded": diagnostics.deployment_loaded,
            "api_version_loaded": diagnostics.api_version_loaded,
            "endpoint_issue": diagnostics.endpoint_issue,
            "endpoint_masked": _mask(diagnostics.endpoint_value),
            "deployment_masked": _mask(diagnostics.deployment_value),
            "api_version_masked": _mask(diagnostics.api_version_value),
            "configured": azure_service.configured,
            "success": False,
            "status_code": None,
            "latency_ms": None,
            "error": None,
            "body": None,
        }

        if not azure_service.configured:
            payload["error"] = "Azure OpenAI not configured."
            return payload
        if diagnostics.endpoint_issue:
            payload["error"] = diagnostics.endpoint_issue
            return payload

        started = perf_counter()
        try:
            response = await azure_service.test_connection()
            payload["success"] = response["status_code"] == 200
            payload["status_code"] = response["status_code"]
            payload["latency_ms"] = round((perf_counter() - started) * 1000, 2)
            payload["body"] = response["body"]
            if not payload["success"]:
                payload["error"] = f"Azure returned HTTP {response['status_code']}"
        except Exception as exc:  # noqa: BLE001
            logger.exception("Azure health test failed")
            payload["error"] = str(exc)
            payload["latency_ms"] = round((perf_counter() - started) * 1000, 2)
        return payload

    @app.get(f"{settings.api_prefix}/debug/azure")
    async def azure_debug() -> dict[str, object]:
        diagnostics = azure_service.diagnostics()
        logger.info(
            "Azure debug request loaded endpoint=%s key=%s deployment=%s api_version=%s",
            diagnostics.endpoint_loaded,
            diagnostics.api_key_loaded,
            diagnostics.deployment_loaded,
            diagnostics.api_version_loaded,
        )
        response: dict[str, object] = {
            "loaded": {
                "endpoint": diagnostics.endpoint_loaded,
                "api_key": diagnostics.api_key_loaded,
                "deployment": diagnostics.deployment_loaded,
                "api_version": diagnostics.api_version_loaded,
            },
            "endpoint": diagnostics.endpoint_value,
            "deployment": diagnostics.deployment_value,
            "api_version": diagnostics.api_version_value,
            "endpoint_issue": diagnostics.endpoint_issue,
            "success": False,
            "status_code": None,
            "latency_ms": None,
            "response": None,
            "error": None,
        }

        if not azure_service.configured:
            response["error"] = "Azure OpenAI not configured."
            return response
        if diagnostics.endpoint_issue:
            response["error"] = diagnostics.endpoint_issue
            return response

        started = perf_counter()
        try:
            result = await azure_service.test_connection()
            response["status_code"] = result["status_code"]
            response["latency_ms"] = result["latency_ms"]
            response["response"] = result["body"]
            response["success"] = result["status_code"] == 200 and "CONNECTED" in str(result["body"])
            if not response["success"]:
                response["error"] = f"Azure returned HTTP {result['status_code']}"
        except Exception as exc:  # noqa: BLE001
            logger.exception("Azure debug request failed")
            response["error"] = str(exc)
            response["latency_ms"] = round((perf_counter() - started) * 1000, 2)
        return response

    @app.post(f"{settings.api_prefix}/upload")
    async def upload_file(
        file: UploadFile = File(...),
        app_settings: Settings = Depends(get_settings),
    ):
        if not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are supported.")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        max_bytes = app_settings.max_upload_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail=f"File exceeds {app_settings.max_upload_mb}MB limit.")

        analysis_id = uuid.uuid4().hex
        filename = Path(file.filename).name
        cache_key = hashlib.sha256(content).hexdigest()
        destination = app_settings.upload_dir / f"{analysis_id}.csv"
        destination.write_bytes(content)

        engine = AnalysisEngine(app_settings)
        try:
            dataframe, response = engine.load_csv(destination, analysis_id, filename)
        except ValueError as exc:
            destination.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        cached_result = app.state.analysis_cache.get(cache_key)
        if cached_result is not None:
            analysis_store.save(
                AnalysisStatus(
                    analysis_id=analysis_id,
                    filename=filename,
                    created_at=datetime.utcnow(),
                    status="completed",
                    current_phase=11,
                    progress_label="Using cached analysis",
                    result=cached_result,
                    error=None,
                    cache_key=cache_key,
                    cleaning_summary=getattr(cached_result.data_quality, "cleaning_summary", None),
                )
            )
            app.state.dataframes[analysis_id] = dataframe
            return response

        analysis_store.save(
            AnalysisStatus(
                analysis_id=analysis_id,
                filename=filename,
                created_at=datetime.utcnow(),
                status="uploaded",
                current_phase=0,
                progress_label="Upload complete",
                result=None,
                error=None,
                cache_key=cache_key,
            )
        )
        app.state.dataframes[analysis_id] = dataframe
        return response

    @app.post(f"{settings.api_prefix}/analyze")
    async def analyze_dataset(
        payload: AnalyzeRequest,
        background_tasks: BackgroundTasks,
        app_settings: Settings = Depends(get_settings),
    ):
        logger.info("Analyze requested analysis_id=%s", payload.analysis_id)
        status = analysis_store.get(payload.analysis_id)
        if not status:
            raise HTTPException(status_code=404, detail="Analysis ID not found.")

        if status.result is not None and status.status == "completed":
            return {"analysis_id": payload.analysis_id, "status": "completed", "cached": True}

        dataframe = app.state.dataframes.get(payload.analysis_id)
        if dataframe is None:
            raise HTTPException(status_code=404, detail="Uploaded dataset not found in memory.")

        analysis_store.update(
            payload.analysis_id,
            status="processing",
            current_phase=1,
            progress_label="Dataset Understanding",
            error=None,
        )
        logger.info("Analyze enqueued analysis_id=%s current_phase=%s", payload.analysis_id, 1)
        background_tasks.add_task(run_analysis_job, app, payload.analysis_id, app_settings)
        return {"analysis_id": payload.analysis_id, "status": "processing"}

    @app.get(f"{settings.api_prefix}/analysis/{{analysis_id}}", response_model=AnalysisLookupResponse)
    async def get_analysis(analysis_id: str):
        status = analysis_store.get(analysis_id)
        if not status:
            raise HTTPException(status_code=404, detail="Analysis not found.")
        return status

    @app.post(f"{settings.api_prefix}/business-insights")
    async def get_business_insights(payload: AnalyzeRequest):
        status = analysis_store.get(payload.analysis_id)
        if not status or not status.result:
            raise HTTPException(status_code=404, detail="Completed analysis not found.")
        return status.result.business_insights

    @app.post(f"{settings.api_prefix}/recommend-models")
    async def get_recommend_models(payload: AnalyzeRequest):
        status = analysis_store.get(payload.analysis_id)
        if not status or not status.result:
            raise HTTPException(status_code=404, detail="Completed analysis not found.")
        return status.result.model_recommendations

    @app.post(f"{settings.api_prefix}/generate-report")
    async def generate_report(payload: AnalyzeRequest):
        status = analysis_store.get(payload.analysis_id)
        if not status or not status.result:
            raise HTTPException(status_code=404, detail="Completed analysis not found.")
        return status.result.executive_report

    @app.get(f"{settings.api_prefix}/reports/{{analysis_id}}")
    async def download_report(analysis_id: str, app_settings: Settings = Depends(get_settings)):
        report_path = app_settings.report_dir / f"{analysis_id}.pdf"
        if not report_path.exists():
            raise HTTPException(status_code=404, detail="Report not found.")
        return FileResponse(report_path, filename=f"insightai-report-{analysis_id}.pdf")

    app.state.dataframes = {}
    app.state.analysis_cache = getattr(app.state, "analysis_cache", {})
    return app


async def run_analysis_job(app: FastAPI, analysis_id: str, settings: Settings) -> None:
    status = analysis_store.get(analysis_id)
    if not status:
        return

    dataframe = app.state.dataframes.get(analysis_id)
    if dataframe is None:
        analysis_store.update(
            analysis_id,
            status="failed",
            error="Dataset frame missing from server memory.",
            progress_label="Analysis failed",
        )
        return

    engine = AnalysisEngine(settings)

    async def progress_callback(phase: int, label: str) -> None:
        logger.info("Analysis progress analysis_id=%s phase=%s label=%s", analysis_id, phase, label)
        analysis_store.update(
            analysis_id,
            current_phase=phase,
            progress_label=label,
            status="processing" if phase < 11 else "completed",
        )

    try:
        logger.info("Analysis job start analysis_id=%s azure_configured=%s endpoint_loaded=%s deployment_loaded=%s api_version=%s",
                    analysis_id,
                    engine.azure.configured,
                    engine.azure.diagnostics().endpoint_loaded,
                    engine.azure.diagnostics().deployment_loaded,
                    engine.azure.diagnostics().api_version_value)
        result = await engine.run_full_analysis(
            analysis_id=analysis_id,
            dataframe=dataframe,
            filename=status.filename,
            progress_callback=progress_callback,
        )
        logger.info("Analysis job complete analysis_id=%s source_business=%s source_model=%s source_report=%s",
                    analysis_id,
                    result.business_insights.source,
                    result.model_recommendations.source,
                    result.executive_report.source)
        if status.cache_key:
            app.state.analysis_cache[status.cache_key] = result
        analysis_store.update(
            analysis_id,
            status="completed",
            current_phase=11,
            progress_label="Executive Report",
            result=result,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Analysis job failed analysis_id=%s", analysis_id)
        analysis_store.update(
            analysis_id,
            status="failed",
            progress_label="Analysis failed",
            error=str(exc),
        )


app = create_app()
