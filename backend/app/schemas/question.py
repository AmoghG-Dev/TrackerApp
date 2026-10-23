from typing import Literal
import re
from pydantic import BaseModel, Field, HttpUrl


Difficulty = Literal["easy", "medium", "hard"]


class QuestionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    url: HttpUrl
    difficulty: Difficulty
    platform: str = Field(default="leetcode")
    platform_id: str | None = None
    topics: list[str] = Field(default_factory=list)
    company_tags: list[str] = Field(default_factory=list)
    frequency_score: int = Field(default=5, ge=1, le=10)


class QuestionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    url: HttpUrl | None = None
    difficulty: Difficulty | None = None
    platform: str | None = None
    topics: list[str] | None = None
    company_tags: list[str] | None = None
    frequency_score: int | None = Field(default=None, ge=1, le=10)


class QuestionResponse(BaseModel):
    id: str
    title: str
    url: str
    difficulty: Difficulty
    platform: str
    platform_id: str | None = None
    topics: list[str] = Field(default_factory=list)
    company_tags: list[str] = Field(default_factory=list)
    frequency_score: int = 5
    status: str = "pending"