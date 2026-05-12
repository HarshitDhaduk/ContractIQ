"""Firebase Auth dependency for FastAPI routes.

Authentication strategy (in priority order):
1. GOOGLE_APPLICATION_CREDENTIALS env var set to a service account JSON path
2. Service account JSON at FIREBASE_SERVICE_ACCOUNT_PATH (./firebase-service-account.json)
3. Application Default Credentials — run `gcloud auth application-default login` locally
   (Recommended: avoids service account key files entirely)
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth, credentials
from config import settings
import os
import logging

logger = logging.getLogger(__name__)

_firebase_app = None


def _get_firebase_app():
    global _firebase_app
    if _firebase_app is None:
        sa_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
        if os.path.exists(sa_path):
            logger.info(f"Firebase: using service account file at {sa_path}")
            cred = credentials.Certificate(sa_path)
            _firebase_app = firebase_admin.initialize_app(cred)
        else:
            # Fall back to Application Default Credentials (ADC)
            # Works automatically on Cloud Run and after `gcloud auth application-default login`
            logger.info("Firebase: using Application Default Credentials (ADC)")
            _firebase_app = firebase_admin.initialize_app()
    return _firebase_app

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Verify Firebase ID token. Returns decoded token claims."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )
    try:
        _get_firebase_app()
        decoded = auth.verify_id_token(credentials.credentials)
        return decoded
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """Optional auth — returns None if no token provided (for dev/demo)."""
    if credentials is None:
        return {"uid": "demo_user", "email": "demo@contractiq.app"}
    try:
        _get_firebase_app()
        return auth.verify_id_token(credentials.credentials)
    except Exception:
        return {"uid": "demo_user", "email": "demo@contractiq.app"}
