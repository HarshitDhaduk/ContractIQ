"""FastAPI application factory."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import upload, jobs, contracts, review, export, playbooks, notifications, users

app = FastAPI(
    title="ContractIQ API",
    description="Multi-agent contract intelligence platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://contractiq.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/v1", tags=["Upload"])
app.include_router(jobs.router, prefix="/v1", tags=["Jobs"])
app.include_router(contracts.router, prefix="/v1", tags=["Contracts"])
app.include_router(review.router, prefix="/v1", tags=["Review"])
app.include_router(export.router, prefix="/v1", tags=["Export"])
app.include_router(playbooks.router, prefix="/v1", tags=["Playbooks"])
app.include_router(notifications.router, prefix="/v1", tags=["Notifications"])
app.include_router(users.router, prefix="/v1", tags=["Users"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "contractiq-api"}
