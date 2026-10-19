from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


Difficulty = Literal["easy", "medium", "hard"]


class QuestionCreate(BaseModel):
    platform: str
    platform_id: str
    title: str
    url: HttpUrl
    difficulty: Difficulty
    topics: list[str] = Field(default_factory=list)
    company_tags: list[str] = Field(default_factory=list)
    frequency_score: int = Field(default=1, ge=1, le=10)


class QuestionResponse(QuestionCreate):
    id: str