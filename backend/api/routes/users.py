from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from api.db import get_db
from api.deps import get_optional_user
from models.user import UserProfile, UserSyncRequest

router = APIRouter()

def _db():
    return get_db()

@router.post("/users/sync")
async def sync_user(body: UserSyncRequest, user: dict = Depends(get_optional_user)):
    """Sync user profile from Firebase Auth to Firestore users collection."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = _db()
    user_ref = db.collection("users").document(user["uid"])
    doc = await user_ref.get()
    
    now = datetime.now(timezone.utc).isoformat()
    
    if doc.exists:
        # Update last login and potentially display name/photo
        update_data = {
            "last_login": now,
            "email": body.email # Ensure email is always up to date
        }
        if body.display_name:
            update_data["display_name"] = body.display_name
        if body.photo_url:
            update_data["photo_url"] = body.photo_url
            
        await user_ref.update(update_data)
        return {"status": "updated", "user_id": user["uid"]}
    else:
        # Create new user profile
        new_user = {
            "user_id": user["uid"],
            "email": body.email,
            "display_name": body.display_name,
            "photo_url": body.photo_url,
            "role": "user",
            "created_at": now,
            "last_login": now,
            "preferences": {}
        }
        await user_ref.set(new_user)
        return {"status": "created", "user_id": user["uid"]}

@router.get("/users/me")
async def get_my_profile(user: dict = Depends(get_optional_user)):
    """Fetch current user's profile from Firestore."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = _db()
    doc = await db.collection("users").document(user["uid"]).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    return doc.to_dict()
