"""AgroElevate AI Service — FastAPI entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.intelligence import router as intelligence_router

app = FastAPI(
    title="AgroElevate Intelligence API",
    description="Phase B — ML-powered agricultural intelligence (free stack)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intelligence_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "agroelevate-ai", "version": "1.0.0"}
