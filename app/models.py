from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class University(Base):
    """대학 정보"""
    __tablename__ = "universities"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)  # 대학 코드 (예: 1003)
    name = Column(String(100), nullable=False)  # 대학명
    region = Column(String(50))  # 지역
    type = Column(String(20))  # 4년제/전문대
    ratio_url = Column(String(500))  # 경쟁률 페이지 URL
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    admissions = relationship("Admission", back_populates="university", cascade="all, delete-orphan")


class Admission(Base):
    """전형 정보"""
    __tablename__ = "admissions"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False)
    admission_type = Column(String(20), nullable=False)  # 수시/정시/편입
    admission_name = Column(String(200), nullable=False)  # 전형명
    year = Column(Integer, nullable=False)  # 학년도 (예: 2026)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    university = relationship("University", back_populates="admissions")
    departments = relationship("Department", back_populates="admission", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('university_id', 'admission_type', 'admission_name', 'year', name='uq_admission'),
        Index('ix_admission_type_year', 'admission_type', 'year'),
    )


class Department(Base):
    """모집단위(학과) 경쟁률 정보"""
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    admission_id = Column(Integer, ForeignKey("admissions.id"), nullable=False)
    campus = Column(String(50))  # 캠퍼스
    name = Column(String(200), nullable=False)  # 모집단위명
    detail = Column(String(200))  # 세부 정보 (전공 등)
    recruit_count = Column(Integer, default=0)  # 모집인원
    apply_count = Column(Integer, default=0)  # 지원인원
    competition_rate = Column(Float, default=0.0)  # 경쟁률
    additional_recruit = Column(Integer, nullable=True)  # 추가모집(충원합격순위)
    actual_competition_rate = Column(Float, nullable=True)  # 실질경쟁률
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    admission = relationship("Admission", back_populates="departments")
    history = relationship("RatioHistory", back_populates="department", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_department_name', 'name'),
    )


class RatioHistory(Base):
    """경쟁률 변동 이력"""
    __tablename__ = "ratio_history"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    recruit_count = Column(Integer, default=0)
    apply_count = Column(Integer, default=0)
    competition_rate = Column(Float, default=0.0)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    department = relationship("Department", back_populates="history")


class CrawlLog(Base):
    """크롤링 로그"""
    __tablename__ = "crawl_logs"

    id = Column(Integer, primary_key=True, index=True)
    university_code = Column(String(20))
    status = Column(String(20))  # success/failed/skipped
    message = Column(String(500))
    duration_seconds = Column(Float)
    crawled_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
