import os
from google.genai import Client
from config import settings

client = Client(api_key=settings.GEMINI_API_KEY)

print("Listing models...")
for m in client.models.list():
    print(f" - {m.name}")
