"""GCS upload / download helpers used by ADK agent tools."""
import uuid
from google.cloud import storage
from config import settings

_client: storage.Client | None = None


def _gcs() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client(project=settings.GCP_PROJECT)
    return _client


def gcs_upload(file_bytes: bytes, filename: str, prefix: str = "raw-docs") -> str:
    """Upload bytes to GCS raw-docs prefix. Returns gs:// URI."""
    bucket = _gcs().bucket(settings.GCS_RAW_BUCKET)
    blob_name = f"{prefix}/{uuid.uuid4().hex}/{filename}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(file_bytes, content_type=_mime(filename))
    return f"gs://{settings.GCS_RAW_BUCKET}/{blob_name}"


def gcs_download(gcs_uri: str) -> bytes:
    """Download bytes from a gs:// URI (raw bucket only)."""
    path = gcs_uri.replace(f"gs://{settings.GCS_RAW_BUCKET}/", "")
    bucket = _gcs().bucket(settings.GCS_RAW_BUCKET)
    return bucket.blob(path).download_as_bytes()


def gcs_download_uri(gcs_uri: str) -> bytes:
    """Download bytes from any gs:// URI."""
    parts = gcs_uri.replace("gs://", "").split("/", 1)
    bucket_name = parts[0]
    blob_path = parts[1]
    bucket = _gcs().bucket(bucket_name)
    return bucket.blob(blob_path).download_as_bytes()

def gcs_upload_export(file_bytes: bytes, filename: str, contract_id: str) -> str:
    """Upload an export artefact to the exports prefix. Returns gs:// URI."""
    bucket = _gcs().bucket(settings.GCS_EXPORT_BUCKET)
    blob_name = f"{settings.GCS_EXPORT_PREFIX}/{contract_id}/{filename}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(file_bytes, content_type=_mime(filename))
    return f"gs://{settings.GCS_EXPORT_BUCKET}/{blob_name}"


def gcs_signed_url(gcs_uri: str, expiry_minutes: int = 60) -> str:
    """Generate a signed download URL (valid for expiry_minutes)."""
    import datetime
    # Extract bucket and path from gs://bucket/path
    parts = gcs_uri.replace("gs://", "").split("/", 1)
    bucket_name = parts[0]
    path = parts[1]
    
    blob = _gcs().bucket(bucket_name).blob(path)
    return blob.generate_signed_url(
        expiration=datetime.timedelta(minutes=expiry_minutes),
        method="GET",
    )


def _mime(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]
    return {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "json": "application/json",
    }.get(ext, "application/octet-stream")
