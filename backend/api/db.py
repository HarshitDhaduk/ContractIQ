from google.cloud import firestore
from config import settings

class FirestoreDB:
    _instance_async = None
    _instance_sync = None

    @classmethod
    def get_async(cls):
        if cls._instance_async is None:
            print("[DB] Initializing global Async Firestore client...")
            cls._instance_async = firestore.AsyncClient(
                project=settings.GCP_PROJECT,
                database=settings.FIRESTORE_DATABASE,
            )
        return cls._instance_async

    @classmethod
    def get_sync(cls):
        if cls._instance_sync is None:
            print("[DB] Initializing global Sync Firestore client...")
            cls._instance_sync = firestore.Client(
                project=settings.GCP_PROJECT,
                database=settings.FIRESTORE_DATABASE,
            )
        return cls._instance_sync

def get_db():
    return FirestoreDB.get_async()

def get_db_sync():
    return FirestoreDB.get_sync()
