"""AgroElevate AI Service — FastAPI entry point."""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routers.intelligence import router as intelligence_router
from app.routers.market_intelligence import router as market_intelligence_router

_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _origins.split(",") if o.strip()] or ["*"]

app = FastAPI(
    title="AgroElevate Intelligence API",
    description="AgroElevate v1.0 RC — agricultural intelligence API",
    version="1.0.0-rc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intelligence_router)
app.include_router(market_intelligence_router)


@app.on_event("startup")
def market_intelligence_startup() -> None:
    from app.market_intelligence.providers.background_refresh import warmup_on_startup

    warmup_on_startup()


@app.exception_handler(Exception)
async def unhandled_exception(_request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "service": "agroelevate-ai", "recoverable": True},
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "agroelevate-ai",
        "version": "1.0.0-rc",
        "environment": os.getenv("RENDER", "local"),
    }
