from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime
import asyncio

from app.database import get_db
from app.models import University, Admission, Department, RatioHistory, CrawlLog
from app.schemas import (
    UniversityResponse,
    UniversityDetailResponse,
    AdmissionResponse,
    DepartmentResponse,
    CompetitionRateResponse,
    CrawlStatusResponse,
    RatioHistoryResponse
)
from app.services.crawl_service import CrawlService
from app.crawler import SmartRatioCrawler, check_jungsi_pages_open

router = APIRouter()

# 크롤링 상태 저장용 (메모리)
crawl_state = {
    "is_running": False,
    "progress": 0,
    "total": 0,
    "current_university": "",
    "results": {"success": 0, "failed": 0, "skipped": 0},
    "started_at": None,
    "logs": []
}


# ============ 대학 관련 API ============

@router.get("/universities", response_model=list[UniversityResponse])
async def get_universities(
    region: Optional[str] = None,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """대학 목록 조회"""
    stmt = select(University)

    if region:
        stmt = stmt.where(University.region == region)
    if type:
        stmt = stmt.where(University.type == type)

    stmt = stmt.order_by(University.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/universities/{university_id}", response_model=UniversityDetailResponse)
async def get_university(
    university_id: int,
    db: AsyncSession = Depends(get_db)
):
    """대학 상세 정보 조회 (전형 및 학과 포함)"""
    stmt = (
        select(University)
        .options(
            selectinload(University.admissions)
            .selectinload(Admission.departments)
        )
        .where(University.id == university_id)
    )
    result = await db.execute(stmt)
    university = result.scalar_one_or_none()

    if not university:
        raise HTTPException(status_code=404, detail="대학을 찾을 수 없습니다")

    return university


# ============ 경쟁률 조회 API ============

@router.get("/competition-rates", response_model=list[CompetitionRateResponse])
async def get_competition_rates(
    university_name: Optional[str] = Query(None, description="대학명 (부분 검색)"),
    department_name: Optional[str] = Query(None, description="학과명 (부분 검색)"),
    admission_type: Optional[str] = Query(None, description="수시/정시"),
    min_rate: Optional[float] = Query(None, description="최소 경쟁률"),
    max_rate: Optional[float] = Query(None, description="최대 경쟁률"),
    limit: int = Query(100, le=10000),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db)
):
    """경쟁률 검색"""
    stmt = (
        select(
            University.name.label("university_name"),
            University.code.label("university_code"),
            Admission.admission_type,
            Admission.admission_name,
            Department.campus,
            Department.name.label("department_name"),
            Department.detail,
            Department.recruit_count,
            Department.apply_count,
            Department.competition_rate,
            Department.additional_recruit,
            Department.actual_competition_rate,
            Department.updated_at
        )
        .join(Admission, University.id == Admission.university_id)
        .join(Department, Admission.id == Department.admission_id)
    )

    # 필터 적용
    if university_name:
        stmt = stmt.where(University.name.contains(university_name))
    if department_name:
        stmt = stmt.where(Department.name.contains(department_name))
    if admission_type:
        stmt = stmt.where(Admission.admission_type == admission_type)
    if min_rate is not None:
        stmt = stmt.where(Department.competition_rate >= min_rate)
    if max_rate is not None:
        stmt = stmt.where(Department.competition_rate <= max_rate)

    stmt = stmt.order_by(
        University.name,
        Admission.admission_name,
        Department.name
    ).offset(offset).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    return [
        CompetitionRateResponse(
            university_name=row.university_name,
            university_code=row.university_code,
            admission_type=row.admission_type,
            admission_name=row.admission_name,
            campus=row.campus,
            department_name=row.department_name,
            detail=row.detail,
            recruit_count=row.recruit_count,
            apply_count=row.apply_count,
            competition_rate=row.competition_rate,
            additional_recruit=row.additional_recruit,
            actual_competition_rate=row.actual_competition_rate,
            updated_at=row.updated_at
        )
        for row in rows
    ]


@router.get("/departments/{department_id}/history", response_model=list[RatioHistoryResponse])
async def get_ratio_history(
    department_id: int,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """학과 경쟁률 변동 이력 조회"""
    stmt = (
        select(RatioHistory)
        .where(RatioHistory.department_id == department_id)
        .order_by(RatioHistory.recorded_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ============ 통계 API ============

@router.get("/statistics/summary")
async def get_statistics_summary(
    admission_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """전체 통계 요약"""
    # 대학 수
    univ_count = await db.execute(select(func.count(University.id)))

    # 전형 수
    adm_stmt = select(func.count(Admission.id))
    if admission_type:
        adm_stmt = adm_stmt.where(Admission.admission_type == admission_type)
    adm_count = await db.execute(adm_stmt)

    # 학과 수
    dept_stmt = select(func.count(Department.id))
    if admission_type:
        dept_stmt = dept_stmt.join(Admission).where(Admission.admission_type == admission_type)
    dept_count = await db.execute(dept_stmt)

    # 평균/최고/최저 경쟁률
    rate_stmt = select(
        func.avg(Department.competition_rate),
        func.max(Department.competition_rate),
        func.min(Department.competition_rate).filter(Department.competition_rate > 0)
    )
    if admission_type:
        rate_stmt = rate_stmt.join(Admission).where(Admission.admission_type == admission_type)
    rate_result = await db.execute(rate_stmt)
    avg_rate, max_rate, min_rate = rate_result.one()

    # 마지막 크롤링 시간
    last_crawl = await db.execute(
        select(CrawlLog.crawled_at)
        .where(CrawlLog.status == "success")
        .order_by(CrawlLog.crawled_at.desc())
        .limit(1)
    )
    last_crawl_time = last_crawl.scalar_one_or_none()

    return {
        "university_count": univ_count.scalar_one(),
        "admission_count": adm_count.scalar_one(),
        "department_count": dept_count.scalar_one(),
        "average_competition_rate": round(avg_rate or 0, 2),
        "max_competition_rate": round(max_rate or 0, 2),
        "min_competition_rate": round(min_rate or 0, 2),
        "last_crawled_at": last_crawl_time
    }


@router.get("/statistics/top-competition")
async def get_top_competition(
    admission_type: Optional[str] = None,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db)
):
    """경쟁률 상위 학과"""
    stmt = (
        select(
            University.name.label("university_name"),
            Admission.admission_name,
            Department.name.label("department_name"),
            Department.competition_rate,
            Department.recruit_count,
            Department.apply_count
        )
        .join(Admission, University.id == Admission.university_id)
        .join(Department, Admission.id == Department.admission_id)
        .where(Department.competition_rate > 0)
    )

    if admission_type:
        stmt = stmt.where(Admission.admission_type == admission_type)

    stmt = stmt.order_by(Department.competition_rate.desc()).limit(limit)
    result = await db.execute(stmt)

    return [
        {
            "university_name": row.university_name,
            "admission_name": row.admission_name,
            "department_name": row.department_name,
            "competition_rate": row.competition_rate,
            "recruit_count": row.recruit_count,
            "apply_count": row.apply_count
        }
        for row in result.all()
    ]


# ============ 크롤링 API ============

@router.post("/crawl/university")
async def crawl_single_university(
    url: str,
    admission_type: str = "정시",
    year: int = 2026,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """단일 대학 크롤링"""
    service = CrawlService(db)

    try:
        university = await service.crawl_and_save(url, admission_type, year)
        if university:
            return {
                "status": "success",
                "message": f"{university.name} 크롤링 완료",
                "university_id": university.id
            }
        return {
            "status": "skipped",
            "message": "경쟁률 데이터를 찾을 수 없습니다"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/crawl/all")
async def crawl_all_universities(
    admission_type: str = "정시",
    year: int = 2026,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """모든 대학 크롤링 (백그라운드)"""
    service = CrawlService(db)

    # 백그라운드에서 실행
    async def run_crawl():
        return await service.crawl_all_universities(admission_type, year)

    background_tasks.add_task(run_crawl)

    return {
        "status": "started",
        "message": "백그라운드에서 크롤링을 시작합니다"
    }


@router.get("/crawl/status", response_model=CrawlStatusResponse)
async def get_crawl_status(db: AsyncSession = Depends(get_db)):
    """크롤링 상태 조회"""
    # 최근 크롤링 로그
    stmt = (
        select(CrawlLog)
        .order_by(CrawlLog.crawled_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    last_log = result.scalar_one_or_none()

    # 통계
    univ_count = await db.execute(select(func.count(University.id)))
    dept_count = await db.execute(select(func.count(Department.id)))

    return CrawlStatusResponse(
        status=last_log.status if last_log else "unknown",
        message=last_log.message if last_log else "크롤링 기록 없음",
        last_crawled_at=last_log.crawled_at if last_log else None,
        total_universities=univ_count.scalar_one(),
        total_departments=dept_count.scalar_one()
    )


@router.get("/crawl/logs")
async def get_crawl_logs(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """크롤링 로그 조회"""
    stmt = select(CrawlLog).order_by(CrawlLog.crawled_at.desc())

    if status:
        stmt = stmt.where(CrawlLog.status == status)

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)

    return [
        {
            "id": log.id,
            "university_code": log.university_code,
            "status": log.status,
            "message": log.message,
            "duration_seconds": log.duration_seconds,
            "crawled_at": log.crawled_at
        }
        for log in result.scalars().all()
    ]


# ============ SmartRatio API ============

@router.get("/smartratio/universities")
async def get_smartratio_universities():
    """
    SmartRatio 페이지에서 대학 목록 조회

    Returns:
        대학 목록 (이름, 지역, 상태, URL 등)
    """
    crawler = SmartRatioCrawler()
    universities = await crawler.fetch_university_list()

    return [
        {
            "name": univ.name,
            "region": univ.region,
            "admission_type": univ.admission_type,
            "period_start": univ.period_start,
            "period_end": univ.period_end,
            "status": univ.status.value,
            "ratio_url": univ.ratio_url,
            "univ_code": univ.univ_code,
        }
        for univ in universities
    ]


@router.get("/smartratio/check-availability")
async def check_availability():
    """
    정시 경쟁률 페이지 오픈 여부 확인

    Returns:
        is_open: 페이지 오픈 여부
        checked_at: 확인 시간
        message: 상태 메시지
    """
    is_open = await check_jungsi_pages_open()

    return {
        "is_open": is_open,
        "checked_at": datetime.now().isoformat(),
        "message": "페이지가 오픈되었습니다!" if is_open else "아직 준비 중입니다.",
        "next_check_recommended": None if is_open else "1분 후 재확인 권장"
    }


@router.get("/smartratio/discover-urls")
async def discover_available_urls(
    limit: int = Query(10, le=100, description="확인할 대학 수")
):
    """
    활성화된 경쟁률 페이지 URL 탐색

    Returns:
        대학별 활성화된 URL 목록
    """
    crawler = SmartRatioCrawler()
    universities = await crawler.fetch_university_list()

    # 지정된 수만큼 확인
    available = await crawler.discover_available_urls(universities[:limit])

    return {
        "total_checked": min(limit, len(universities)),
        "available_count": len(available),
        "universities": [
            {
                "name": univ.name,
                "ratio_url": univ.ratio_url,
                "univ_code": univ.univ_code,
                "status": univ.status.value
            }
            for univ in available
        ]
    }


@router.post("/smartratio/crawl-all")
async def crawl_all_from_smartratio(
    background_tasks: BackgroundTasks,
    admission_type: str = "정시",
    year: int = 2026,
    delay: float = Query(1.0, ge=0.5, le=5.0, description="요청 간 딜레이(초)"),
    db: AsyncSession = Depends(get_db)
):
    """
    SmartRatio 페이지의 모든 대학 크롤링 (백그라운드)

    1. SmartRatio에서 대학 목록 수집
    2. 활성화된 URL 탐색
    3. 전체 크롤링 실행
    """
    global crawl_state

    if crawl_state["is_running"]:
        return {
            "status": "already_running",
            "message": "이미 크롤링이 진행 중입니다",
            "progress": crawl_state["progress"],
            "total": crawl_state["total"]
        }

    async def run_full_crawl():
        global crawl_state
        crawl_state["is_running"] = True
        crawl_state["started_at"] = datetime.now()
        crawl_state["logs"] = []
        crawl_state["results"] = {"success": 0, "failed": 0, "skipped": 0}

        try:
            # 1. 대학 목록 수집
            crawler = SmartRatioCrawler()
            crawl_state["logs"].append("대학 목록 수집 중...")
            universities = await crawler.fetch_university_list()
            crawl_state["total"] = len(universities)

            # 2. 활성화된 URL 탐색
            crawl_state["logs"].append(f"{len(universities)}개 대학 URL 확인 중...")
            available = await crawler.discover_available_urls(universities)

            if not available:
                crawl_state["logs"].append("활성화된 페이지가 없습니다.")
                return

            crawl_state["logs"].append(f"{len(available)}개 대학 페이지 활성화 확인")

            # 3. 크롤링 실행
            service = CrawlService(db)
            for i, univ in enumerate(available):
                crawl_state["progress"] = i + 1
                crawl_state["current_university"] = univ.name

                try:
                    if univ.ratio_url:
                        result = await service.crawl_and_save(
                            univ.ratio_url,
                            admission_type,
                            year
                        )
                        if result:
                            crawl_state["results"]["success"] += 1
                            crawl_state["logs"].append(f"✓ {univ.name} 완료")
                        else:
                            crawl_state["results"]["skipped"] += 1
                except Exception as e:
                    crawl_state["results"]["failed"] += 1
                    crawl_state["logs"].append(f"✗ {univ.name} 실패: {str(e)[:50]}")

                await asyncio.sleep(delay)

        finally:
            crawl_state["is_running"] = False
            crawl_state["logs"].append("크롤링 완료")

    background_tasks.add_task(run_full_crawl)

    return {
        "status": "started",
        "message": "SmartRatio 전체 크롤링을 시작합니다",
        "started_at": datetime.now().isoformat()
    }


@router.get("/smartratio/crawl-progress")
async def get_crawl_progress():
    """
    현재 크롤링 진행 상황 조회
    """
    return {
        "is_running": crawl_state["is_running"],
        "progress": crawl_state["progress"],
        "total": crawl_state["total"],
        "current_university": crawl_state["current_university"],
        "results": crawl_state["results"],
        "started_at": crawl_state["started_at"].isoformat() if crawl_state["started_at"] else None,
        "recent_logs": crawl_state["logs"][-10:]  # 최근 10개 로그
    }
