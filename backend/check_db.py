import asyncio
from google.cloud import firestore
from config import settings

async def check():
    db = firestore.AsyncClient(project=settings.GCP_PROJECT, database=settings.FIRESTORE_DATABASE)
    docs = [d.id async for d in db.collection('jobs').document('job_bea5247ee14e').collection('contracts').stream()]
    print(f'Contracts found: {len(docs)}')
    for d in docs:
        print(f" - {d}")

if __name__ == "__main__":
    asyncio.run(check())
