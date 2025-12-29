from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# University Schemas
class UniversityBase(BaseModel):
    code: str
    name: str
    region: Optional[str] = None
    type: Optional[str] = None
    ratio_url: Optional[str] = None


class UniversityCreate(UniversityBase):
    pass


class UniversityResponse(UniversityBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Department Schemas
class DepartmentBase(BaseModel):
    campus: Optional[str] = None
    name: str
    detail: Optional[str] = None
    recruit_count: int = 0
    apply_count: int = 0
    competition_rate: float = 0.0
    additional_recruit: Optional[int] = None
    actual_competition_rate: Optional[float] = None


class DepartmentCreate(DepartmentBase):
    admission_id: int


class DepartmentResponse(DepartmentBase):
    id: int
    admission_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Admission Schemas
class AdmissionBase(BaseModel):
    admission_type: str
    admission_name: str
    year: int


class AdmissionCreate(AdmissionBase):
    university_id: int


class AdmissionResponse(AdmissionBase):
    id: int
    university_id: int
    departments: list[DepartmentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# Ratio History Schemas
class RatioHistoryResponse(BaseModel):
    id: int
    department_id: int
    recruit_count: int
    apply_count: int
    competition_rate: float
    recorded_at: datetime

    class Config:
        from_attributes = True


# API Response Schemas
class UniversityDetailResponse(UniversityResponse):
    admissions: list[AdmissionResponse] = []


class CompetitionRateResponse(BaseModel):
    university_name: str
    university_code: str
    admission_type: str
    admission_name: str
    campus: Optional[str]
    department_name: str
    detail: Optional[str]
    recruit_count: int
    apply_count: int
    competition_rate: float
    additional_recruit: Optional[int] = None
    actual_competition_rate: Optional[float] = None
    updated_at: Optional[datetime]


class CrawlStatusResponse(BaseModel):
    status: str
    message: str
    last_crawled_at: Optional[datetime] = None
    total_universities: int = 0
    total_departments: int = 0


class SearchRequest(BaseModel):
    university_name: Optional[str] = None
    department_name: Optional[str] = None
    admission_type: Optional[str] = None  # 수시/정시
    region: Optional[str] = None
    min_competition_rate: Optional[float] = None
    max_competition_rate: Optional[float] = None
