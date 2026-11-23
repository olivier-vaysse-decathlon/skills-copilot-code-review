"""Database-backed public announcements and authenticated management."""

from datetime import date, datetime, timezone
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..database import announcements_collection
from .auth import require_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    message: str = Field(min_length=1, max_length=2000)
    expires_on: date
    starts_on: date | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.starts_on and self.starts_on > self.expires_on:
            logger.warning("Rejected announcement with expiration before start date")
            raise ValueError("Start date must be on or before expiration date")
        return self


class Announcement(AnnouncementInput):
    id: str


def announcement_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        logger.warning("Invalid announcement identifier")
        raise HTTPException(status_code=404, detail="Announcement not found")
    return ObjectId(value)


def serialize(document) -> dict:
    return {
        "id": str(document["_id"]),
        "message": document["message"],
        "starts_on": document.get("starts_on"),
        "expires_on": document["expires_on"]
    }


@router.get("", response_model=list[Announcement])
def list_active(response: Response):
    """Public messages active today (inclusive UTC calendar dates)."""
    response.headers["Cache-Control"] = "no-store"
    today = datetime.now(timezone.utc).date().isoformat()
    query = {
        "expires_on": {"$gte": today},
        "$or": [{"starts_on": None}, {"starts_on": {"$lte": today}}]
    }
    return [serialize(doc) for doc in announcements_collection.find(query).sort("expires_on", 1)]


@router.get("/manage", response_model=list[Announcement], dependencies=[Depends(require_user)])
def list_all(response: Response):
    """List live, scheduled, and expired messages for signed-in teachers."""
    response.headers["Cache-Control"] = "no-store"
    return [serialize(doc) for doc in announcements_collection.find().sort("expires_on", -1)]


@router.post("", response_model=Announcement, status_code=201, dependencies=[Depends(require_user)])
def create_announcement(announcement: AnnouncementInput):
    document = announcement.model_dump(mode="json")
    result = announcements_collection.insert_one(document)
    return {"id": str(result.inserted_id), **announcement.model_dump(mode="json")}


@router.put("/{identifier}", response_model=Announcement, dependencies=[Depends(require_user)])
def update_announcement(identifier: str, announcement: AnnouncementInput):
    result = announcements_collection.update_one(
        {"_id": announcement_id(identifier)},
        {"$set": announcement.model_dump(mode="json")}
    )
    if not result.matched_count:
        logger.warning("Announcement update target not found")
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"id": identifier, **announcement.model_dump(mode="json")}


@router.delete("/{identifier}", status_code=204, dependencies=[Depends(require_user)])
def delete_announcement(identifier: str):
    result = announcements_collection.delete_one({"_id": announcement_id(identifier)})
    if not result.deleted_count:
        logger.warning("Announcement delete target not found")
        raise HTTPException(status_code=404, detail="Announcement not found")
