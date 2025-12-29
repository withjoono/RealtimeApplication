from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging

from app.config import get_settings
from app.database import init_db, async_session
from app.api.routes import router
from app.services.crawl_service import CrawlService

settings = get_settings()
scheduler = AsyncIOScheduler()
logger = logging.getLogger(__name__)


async def scheduled_crawl():
    """스케줄된 크롤링 작업"""
    logger.info("[Scheduler] Starting crawl...")
    async with async_session() as db:
        service = CrawlService(db)
        try:
            result = await service.crawl_all_universities(
                admission_type="정시",
                year=2026,
                delay=1.0
            )
            logger.info(f"[Scheduler] Crawl completed: {result}")
        except Exception as e:
            logger.error(f"[Scheduler] Crawl failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 코드"""
    # 시작 시
    logger.info("[App] Application Rate API starting...")
    await init_db()
    logger.info("[App] Database initialized")

    # 스케줄러 설정
    scheduler.add_job(
        scheduled_crawl,
        trigger=IntervalTrigger(minutes=settings.crawl_interval_minutes),
        id="crawl_job",
        name="Competition Rate Crawl",
        replace_existing=True
    )
    scheduler.start()
    logger.info(f"[App] Scheduler started (interval: {settings.crawl_interval_minutes} min)")

    yield

    # 종료 시
    scheduler.shutdown()
    logger.info("[App] Application Rate API stopped")


app = FastAPI(
    title="Competition Rate API",
    description="""
    ## Jinhak Apply Competition Rate Crawler API

    ### Features
    - Real-time competition rate lookup
    - University/Department search
    - Rate history tracking
    - Auto-crawling scheduler

    ### Data Source
    - Jinhak Apply (jinhakapply.com)
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(router, prefix="/api/v1", tags=["Competition Rate API"])


@app.get("/")
async def root():
    """API 상태 확인"""
    return {
        "name": "Competition Rate API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy"}
