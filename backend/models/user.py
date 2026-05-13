from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserProfile(BaseModel):
    user_id: str
    email: EmailStr
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    role: str = "user"  # user, admin, reviewer
    org_id: Optional[str] = None
    created_at: str
    last_login: str
    preferences: dict = {}

class UserSyncRequest(BaseModel):
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    email: EmailStr
