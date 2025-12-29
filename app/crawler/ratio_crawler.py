import httpx
from bs4 import BeautifulSoup, Tag
import re
import asyncio
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime
from app.config import get_settings

settings = get_settings()


@dataclass
class DepartmentRatio:
    """학과별 경쟁률 데이터"""
    campus: Optional[str] = None
    name: str = ""
    detail: Optional[str] = None  # 전공 등 세부정보
    recruit_count: int = 0
    apply_count: int = 0
    competition_rate: float = 0.0


@dataclass
class AdmissionRatio:
    """전형별 경쟁률 데이터"""
    admission_name: str = ""
    total_recruit: int = 0
    total_apply: int = 0
    total_rate: float = 0.0
    departments: list[DepartmentRatio] = field(default_factory=list)


@dataclass
class UniversityRatio:
    """대학 전체 경쟁률 데이터"""
    university_name: str = ""
    university_code: str = ""
    admission_type: str = ""  # 수시/정시
    year: int = 2026
    admissions: list[AdmissionRatio] = field(default_factory=list)
    crawled_at: datetime = field(default_factory=datetime.now)


class RatioCrawler:
    """
    진학사 경쟁률 페이지 크롤러

    페이지 구조:
    - tableRatio2: 전형별 요약 테이블 (전형명, 모집인원, 지원인원, 경쟁률)
    - tableRatio3: 전형별 상세 테이블 (캠퍼스[rowspan], 모집단위, 모집인원, 지원인원, 경쟁률)
    """

    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://apply.jinhakapply.com/",
        }

    def _parse_number(self, text: str) -> int:
        """숫자 문자열 파싱 (콤마 제거)"""
        if not text:
            return 0
        cleaned = re.sub(r"[^\d]", "", text)
        return int(cleaned) if cleaned else 0

    def _parse_rate(self, text: str) -> float:
        """경쟁률 문자열 파싱 (예: '3.5 : 1' -> 3.5)"""
        if not text:
            return 0.0
        match = re.search(r"([\d.]+)\s*:\s*1", text)
        if match:
            return float(match.group(1))
        match = re.search(r"[\d.]+", text)
        if match:
            return float(match.group(0))
        return 0.0

    def _extract_university_name(self, soup: BeautifulSoup) -> str:
        """페이지에서 대학명 추출"""
        title = soup.find("title")
        if title:
            text = title.get_text()
            match = re.match(r"(.+?)(?:\s*경쟁률|\s*-|\s*\|)", text)
            if match:
                return match.group(1).strip()
            return text.strip()

        for tag in ["h1", "h2", ".univ-name", "#univName"]:
            elem = soup.select_one(tag)
            if elem:
                return elem.get_text(strip=True)

        return "Unknown University"

    def _parse_summary_table(self, table: Tag) -> list[dict]:
        """요약 테이블(tableRatio2)에서 전형 목록 추출"""
        admissions = []
        rows = table.find_all("tr")

        for row in rows[1:]:  # 헤더 제외
            cells = row.find_all(["td", "th"])
            if len(cells) >= 4:
                name = cells[0].get_text(strip=True)
                # 합계 행 스킵
                if "합계" in name or "총계" in name or "소계" in name:
                    continue

                admissions.append({
                    "name": name,
                    "recruit": self._parse_number(cells[1].get_text()),
                    "apply": self._parse_number(cells[2].get_text()),
                    "rate": self._parse_rate(cells[3].get_text())
                })

        return admissions

    def _parse_detail_table(self, table: Tag) -> list[DepartmentRatio]:
        """상세 테이블(tableRatio3)에서 학과별 데이터 추출 (rowspan 처리)"""
        departments = []
        rows = table.find_all("tr")

        if not rows:
            return departments

        # 헤더 분석
        header_row = rows[0]
        headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

        # 캠퍼스 컬럼 존재 여부 확인
        has_campus = any("캠퍼스" in h for h in headers)

        # 현재 캠퍼스 (rowspan 처리용)
        current_campus = None
        campus_remaining_rows = 0

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue

            # 합계 행 스킵
            first_text = cells[0].get_text(strip=True)
            if "합계" in first_text or "총계" in first_text or "소계" in first_text:
                continue

            try:
                if has_campus:
                    # rowspan 처리
                    if campus_remaining_rows > 0:
                        # 캠퍼스 셀이 병합되어 있어 현재 행에는 없음
                        campus_remaining_rows -= 1
                        # 셀 인덱스 조정 (캠퍼스 없이 시작)
                        name_idx = 0
                        recruit_idx = 1
                        apply_idx = 2
                        rate_idx = 3
                    else:
                        # 새 캠퍼스 시작
                        campus_cell = cells[0]
                        current_campus = campus_cell.get_text(strip=True)
                        rowspan = campus_cell.get("rowspan")
                        if rowspan:
                            campus_remaining_rows = int(rowspan) - 1

                        name_idx = 1
                        recruit_idx = 2
                        apply_idx = 3
                        rate_idx = 4
                else:
                    # 캠퍼스 없음
                    name_idx = 0
                    recruit_idx = 1
                    apply_idx = 2
                    rate_idx = 3

                # 데이터 추출
                if len(cells) > rate_idx:
                    dept = DepartmentRatio(
                        campus=current_campus,
                        name=cells[name_idx].get_text(strip=True),
                        recruit_count=self._parse_number(cells[recruit_idx].get_text()),
                        apply_count=self._parse_number(cells[apply_idx].get_text()),
                        competition_rate=self._parse_rate(cells[rate_idx].get_text())
                    )

                    # 유효한 데이터만 추가
                    if dept.name and dept.name not in ["합계", "총계", "소계"]:
                        departments.append(dept)

            except (IndexError, ValueError) as e:
                continue

        return departments

    def _parse_admissions(self, soup: BeautifulSoup) -> list[AdmissionRatio]:
        """전형별 데이터 추출"""
        admissions = []

        # 1. 요약 테이블에서 전형명 목록 가져오기
        summary_table = soup.find("table", class_="tableRatio2")
        admission_summaries = []
        if summary_table:
            admission_summaries = self._parse_summary_table(summary_table)

        # 2. 상세 테이블들에서 학과별 데이터 가져오기
        detail_tables = soup.find_all("table", class_="tableRatio3")

        # 전형 수와 테이블 수 매칭
        for i, summary in enumerate(admission_summaries):
            if i < len(detail_tables):
                departments = self._parse_detail_table(detail_tables[i])
            else:
                departments = []

            admissions.append(AdmissionRatio(
                admission_name=summary["name"],
                total_recruit=summary["recruit"],
                total_apply=summary["apply"],
                total_rate=summary["rate"],
                departments=departments
            ))

        # 요약 테이블이 없는 경우: 상세 테이블만 파싱
        if not admissions and detail_tables:
            for i, table in enumerate(detail_tables):
                departments = self._parse_detail_table(table)
                if departments:
                    admissions.append(AdmissionRatio(
                        admission_name=f"전형 {i + 1}",
                        departments=departments
                    ))

        return admissions

    async def crawl(self, url: str, admission_type: str = "정시", year: int = 2026) -> Optional[UniversityRatio]:
        """
        경쟁률 페이지 크롤링

        Args:
            url: 경쟁률 페이지 URL
            admission_type: 수시/정시
            year: 학년도

        Returns:
            UniversityRatio 또는 None (실패 시)
        """
        async with httpx.AsyncClient(headers=self.headers, timeout=30.0) as client:
            try:
                response = await client.get(url)
                response.raise_for_status()

                content = response.content
                try:
                    html = content.decode("utf-8")
                except UnicodeDecodeError:
                    html = content.decode("euc-kr", errors="ignore")

                soup = BeautifulSoup(html, "lxml")

                university_name = self._extract_university_name(soup)

                match = re.search(r"Ratio(\d+)\.html", url)
                university_code = match.group(1) if match else ""

                admissions = self._parse_admissions(soup)

                if not admissions:
                    print(f"경쟁률 데이터를 찾을 수 없음: {url}")
                    return None

                return UniversityRatio(
                    university_name=university_name,
                    university_code=university_code,
                    admission_type=admission_type,
                    year=year,
                    admissions=admissions,
                    crawled_at=datetime.now()
                )

            except httpx.HTTPStatusError as e:
                print(f"HTTP 오류 ({e.response.status_code}): {url}")
                return None
            except Exception as e:
                print(f"크롤링 오류: {e} - {url}")
                return None

    async def crawl_multiple(
        self,
        urls: list[str],
        admission_type: str = "정시",
        year: int = 2026,
        delay: float = 0.5
    ) -> list[UniversityRatio]:
        """
        여러 대학 경쟁률 페이지 크롤링
        """
        results = []

        for url in urls:
            result = await self.crawl(url, admission_type, year)
            if result:
                results.append(result)
            await asyncio.sleep(delay)

        return results
