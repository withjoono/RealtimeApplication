from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime
import asyncio
from typing import Optional

from app.models import University, Admission, Department, RatioHistory, CrawlLog
from app.crawler import RatioCrawler, UniversityListCrawler
from app.crawler.ratio_crawler import UniversityRatio


class CrawlService:
    """크롤링 및 데이터 저장 서비스"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ratio_crawler = RatioCrawler()
        self.univ_crawler = UniversityListCrawler()

    async def save_university_ratio(self, ratio_data: UniversityRatio) -> University:
        """
        크롤링한 경쟁률 데이터를 DB에 저장

        Args:
            ratio_data: 크롤링 결과

        Returns:
            저장된 University 객체
        """
        # 1. 대학 정보 upsert
        univ_code = ratio_data.university_code[:4]  # 대학 코드만 추출
        stmt = select(University).where(University.code == univ_code)
        result = await self.db.execute(stmt)
        university = result.scalar_one_or_none()

        if not university:
            university = University(
                code=univ_code,
                name=ratio_data.university_name,
                ratio_url=f"https://addon.jinhakapply.com/RatioV1/RatioH/Ratio{ratio_data.university_code}.html"
            )
            self.db.add(university)
            await self.db.flush()
        else:
            university.name = ratio_data.university_name
            university.updated_at = datetime.now()

        # 2. 전형별 데이터 저장
        for adm_data in ratio_data.admissions:
            # 전형 upsert
            stmt = select(Admission).where(and_(
                Admission.university_id == university.id,
                Admission.admission_type == ratio_data.admission_type,
                Admission.admission_name == adm_data.admission_name,
                Admission.year == ratio_data.year
            ))
            result = await self.db.execute(stmt)
            admission = result.scalar_one_or_none()

            if not admission:
                admission = Admission(
                    university_id=university.id,
                    admission_type=ratio_data.admission_type,
                    admission_name=adm_data.admission_name,
                    year=ratio_data.year
                )
                self.db.add(admission)
                await self.db.flush()

            # 3. 학과별 데이터 저장
            for dept_data in adm_data.departments:
                # 기존 학과 찾기
                stmt = select(Department).where(and_(
                    Department.admission_id == admission.id,
                    Department.name == dept_data.name,
                    Department.campus == dept_data.campus
                ))
                result = await self.db.execute(stmt)
                department = result.scalar_one_or_none()

                if not department:
                    department = Department(
                        admission_id=admission.id,
                        campus=dept_data.campus,
                        name=dept_data.name,
                        detail=dept_data.detail,
                        recruit_count=dept_data.recruit_count,
                        apply_count=dept_data.apply_count,
                        competition_rate=dept_data.competition_rate
                    )
                    self.db.add(department)
                    await self.db.flush()
                else:
                    # 경쟁률 변동 시 이력 기록
                    if (department.apply_count != dept_data.apply_count or
                            department.competition_rate != dept_data.competition_rate):
                        history = RatioHistory(
                            department_id=department.id,
                            recruit_count=department.recruit_count,
                            apply_count=department.apply_count,
                            competition_rate=department.competition_rate
                        )
                        self.db.add(history)

                    # 데이터 업데이트
                    department.recruit_count = dept_data.recruit_count
                    department.apply_count = dept_data.apply_count
                    department.competition_rate = dept_data.competition_rate
                    department.detail = dept_data.detail
                    department.updated_at = datetime.now()

        await self.db.commit()
        return university

    async def crawl_and_save(
        self,
        url: str,
        admission_type: str = "정시",
        year: int = 2026
    ) -> Optional[University]:
        """
        단일 대학 크롤링 및 저장

        Args:
            url: 경쟁률 페이지 URL
            admission_type: 수시/정시
            year: 학년도

        Returns:
            저장된 University 또는 None
        """
        start_time = datetime.now()

        try:
            ratio_data = await self.ratio_crawler.crawl(url, admission_type, year)

            if ratio_data:
                university = await self.save_university_ratio(ratio_data)

                # 성공 로그
                duration = (datetime.now() - start_time).total_seconds()
                log = CrawlLog(
                    university_code=ratio_data.university_code,
                    status="success",
                    message=f"크롤링 완료: {len(ratio_data.admissions)}개 전형",
                    duration_seconds=duration
                )
                self.db.add(log)
                await self.db.commit()

                return university

            # 데이터 없음 로그
            log = CrawlLog(
                university_code=url,
                status="skipped",
                message="경쟁률 데이터 없음",
                duration_seconds=(datetime.now() - start_time).total_seconds()
            )
            self.db.add(log)
            await self.db.commit()
            return None

        except Exception as e:
            # 실패 로그
            log = CrawlLog(
                university_code=url,
                status="failed",
                message=str(e)[:500],
                duration_seconds=(datetime.now() - start_time).total_seconds()
            )
            self.db.add(log)
            await self.db.commit()
            raise

    async def crawl_all_universities(
        self,
        admission_type: str = "정시",
        year: int = 2026,
        delay: float = 1.0
    ) -> dict:
        """
        모든 대학 크롤링

        Returns:
            결과 요약 dict
        """
        # 대학 목록 조회
        universities = await self.univ_crawler.get_universities(admission_type)

        results = {
            "total": len(universities),
            "success": 0,
            "failed": 0,
            "skipped": 0
        }

        for univ in universities:
            if not univ.ratio_url:
                results["skipped"] += 1
                continue

            try:
                university = await self.crawl_and_save(
                    univ.ratio_url,
                    admission_type,
                    year
                )
                if university:
                    results["success"] += 1
                else:
                    results["skipped"] += 1
            except Exception as e:
                print(f"크롤링 실패 ({univ.name}): {e}")
                results["failed"] += 1

            await asyncio.sleep(delay)

        return results
