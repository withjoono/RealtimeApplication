"""
SmartRatio 메인 페이지 크롤러

진학사 SmartRatio 페이지에서 대학 목록 및 경쟁률 페이지 URL을 추출합니다.
https://apply.jinhakapply.com/SmartRatio
"""

import httpx
from bs4 import BeautifulSoup
import re
import asyncio
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.config import get_settings

settings = get_settings()


class UniversityStatus(str, Enum):
    """대학 경쟁률 페이지 상태"""
    PREPARING = "준비중"      # 페이지 미오픈
    SCHEDULED = "접수예정"    # 곧 오픈 예정
    OPEN = "접수중"          # 페이지 활성화
    CLOSED = "마감"          # 접수 마감
    UNKNOWN = "알수없음"


@dataclass
class SmartRatioUniversity:
    """SmartRatio 페이지에서 추출한 대학 정보"""
    name: str                           # 대학명
    region: str = ""                    # 지역
    admission_type: str = "정시모집"     # 입시구분
    period_start: Optional[str] = None  # 접수 시작일
    period_end: Optional[str] = None    # 접수 종료일
    status: UniversityStatus = UniversityStatus.UNKNOWN

    # URL 관련
    ratio_url: Optional[str] = None     # 경쟁률 페이지 URL
    univ_code: Optional[str] = None     # 대학 코드
    type_code: Optional[str] = None     # 전형 코드 (031=수시, 032=정시)

    # onclick 파라미터
    onclick_params: dict = field(default_factory=dict)


class SmartRatioCrawler:
    """
    진학사 SmartRatio 페이지 크롤러

    기능:
    1. 대학 목록 추출
    2. 페이지 활성화 상태 확인
    3. 경쟁률 페이지 URL 생성/추출
    """

    def __init__(self):
        self.base_url = settings.smart_ratio_url
        self.ratio_base = settings.ratio_base_url
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://apply.jinhakapply.com/",
        }

    def _parse_status(self, status_text: str) -> UniversityStatus:
        """상태 텍스트를 Enum으로 변환"""
        status_map = {
            "준비중": UniversityStatus.PREPARING,
            "접수예정": UniversityStatus.SCHEDULED,
            "접수중": UniversityStatus.OPEN,
            "마감": UniversityStatus.CLOSED,
        }
        return status_map.get(status_text.strip(), UniversityStatus.UNKNOWN)

    def _parse_period(self, period_text: str) -> tuple[Optional[str], Optional[str]]:
        """기간 텍스트 파싱 (예: '2025-12-29 ~ 2025-12-31')"""
        if not period_text:
            return None, None

        # ~ 또는 - 로 분리
        parts = re.split(r'\s*[~-]\s*', period_text.strip())
        if len(parts) >= 2:
            return parts[0].strip(), parts[1].strip()
        elif len(parts) == 1:
            return parts[0].strip(), None
        return None, None

    def _extract_onclick_params(self, onclick_str: str) -> dict:
        """onclick 속성에서 파라미터 추출"""
        params = {}

        if not onclick_str:
            return params

        # 패턴: goRatio('1003', '032') 또는 goRatio('10030321')
        # 다양한 패턴 시도
        patterns = [
            r"goRatio\s*\(\s*'(\d+)'\s*,\s*'(\d+)'\s*\)",  # goRatio('1003', '032')
            r"goRatio\s*\(\s*'(\d+)'\s*\)",                 # goRatio('10030321')
            r"Ratio(\d+)\.html",                           # Ratio10030321.html
        ]

        for pattern in patterns:
            match = re.search(pattern, onclick_str)
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    params["univ_code"] = groups[0]
                    params["type_code"] = groups[1]
                elif len(groups) == 1:
                    full_code = groups[0]
                    if len(full_code) >= 7:
                        params["univ_code"] = full_code[:4]
                        params["type_code"] = full_code[4:7]
                        params["full_code"] = full_code
                break

        return params

    def _generate_ratio_url(self, params: dict) -> Optional[str]:
        """파라미터로부터 경쟁률 URL 생성"""
        if "full_code" in params:
            return f"{self.ratio_base}Ratio{params['full_code']}.html"

        if "univ_code" in params and "type_code" in params:
            # 버전 번호 추가 (1, 2 등 시도)
            code = f"{params['univ_code']}{params['type_code']}1"
            return f"{self.ratio_base}Ratio{code}.html"

        return None

    async def fetch_university_list(self) -> list[SmartRatioUniversity]:
        """
        SmartRatio 메인 페이지에서 대학 목록 추출

        Note: SmartRatio는 JavaScript SPA로 렌더링됨.
        정적 HTML 파싱이 어려워 하드코딩된 대학 목록을 사용하고,
        페이지 오픈 시 실제 URL을 탐색하는 방식으로 동작.

        Returns:
            SmartRatioUniversity 리스트
        """
        # 하드코딩된 정시 대학 목록 (SmartRatio 페이지 기반)
        # 실제 페이지 오픈 시 URL 탐색으로 보완
        jungsi_universities = [
            ("가야대학교", "경남"), ("가천대학교", "경기"), ("강서대학교", "서울"),
            ("건국대학교 서울캠퍼스", "서울"), ("건국대학교(글로컬)", "충북"),
            ("건양대학교", "충남"), ("경남대학교", "경남"), ("경동대학교", "강원"),
            ("경상국립대학교", "경남"), ("경운대학교", "경북"), ("경인교육대학교", "인천"),
            ("경일대학교", "경북"), ("국립공주대학교", "충남"), ("국립군산대학교", "전북"),
            ("국립목포대학교", "전남"), ("국립목포해양대학교", "전남"), ("국립부경대학교", "부산"),
            ("국립순천대학교", "전남"), ("국립인천대학교", "인천"), ("국립창원대학교", "경남"),
            ("국립한국교통대학교", "충북"), ("국립한밭대학교", "대전"), ("김천대학교", "경북"),
            ("단국대학교", "경기"), ("대구가톨릭대학교", "경북"), ("대구대학교", "경북"),
            ("대구한의대학교", "경북"), ("대신대학교", "경북"), ("대전대학교", "대전"),
            ("덕성여자대학교", "서울"), ("동국대학교(서울)", "서울"), ("동국대학교(WISE)", "경북"),
            ("동명대학교", "부산"), ("동서대학교", "부산"), ("동아대학교", "부산"),
            ("동양대학교", "경북"), ("명지대학교", "서울"), ("목원대학교", "대전"),
            ("부산가톨릭대학교", "부산"), ("부산교육대학교", "부산"), ("부산대학교", "부산"),
            ("부산외국어대학교", "부산"), ("삼육대학교", "서울"), ("서강대학교", "서울"),
            ("서경대학교", "서울"), ("서울기독대학교", "서울"), ("서울대학교", "서울"),
            ("서울여자대학교", "서울"), ("서울한영대학교", "서울"), ("서원대학교", "충북"),
            ("성결대학교", "경기"), ("성공회대학교", "서울"), ("성균관대학교", "서울"),
            ("성신여자대학교", "서울"), ("세명대학교", "충북"), ("세종대학교", "서울"),
            ("세한대학교", "전남"), ("수원대학교", "경기"), ("숙명여자대학교", "서울"),
            ("숭실대학교", "서울"), ("신라대학교", "부산"), ("신한대학교", "경기"),
            ("아주대학교", "경기"), ("연세대학교(서울)", "서울"), ("영산대학교", "경남"),
            ("예원예술대학교", "전북"), ("우석대학교", "전북"), ("위덕대학교", "경북"),
            ("유원대학교(U1대학교)", "충북"), ("을지대학교", "대전"), ("이화여자대학교", "서울"),
            ("조선대학교", "광주"), ("중부대학교", "충남"), ("중원대학교", "충북"),
            ("창신대학교", "경남"), ("청주교육대학교", "충북"), ("춘천교육대학교", "강원"),
            ("충남대학교", "대전"), ("충북대학교", "충북"), ("한경국립대학교", "경기"),
            ("한국공학대학교", "경기"), ("한국교원대학교", "충북"), ("한국성서대학교", "서울"),
            ("한국체육대학교", "서울"), ("한국항공대학교", "경기"), ("한남대학교", "대전"),
            ("한동대학교", "경북"), ("한서대학교", "충남"), ("한신대학교", "경기"),
            ("한양대학교(서울)", "서울"), ("한양대학교(ERICA)", "경기"), ("호남대학교", "광주"),
            ("호원대학교", "전북"), ("홍익대학교(서울)", "서울"), ("홍익대학교(세종)", "세종"),
            ("화성의과학대학교", "경기"),
        ]

        universities = []
        for name, region in jungsi_universities:
            universities.append(SmartRatioUniversity(
                name=name,
                region=region,
                admission_type="정시모집",
                period_start="2025-12-29",
                period_end="2025-12-31",
                status=UniversityStatus.PREPARING,
            ))

        return universities

    def _parse_row(self, row) -> Optional[SmartRatioUniversity]:
        """테이블 행에서 대학 정보 추출"""
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            return None

        # 일반적인 구조: [지역, 대학명(링크), 입시구분, 기간, 상태]
        univ = SmartRatioUniversity(name="")

        for i, cell in enumerate(cells):
            text = cell.get_text(strip=True)

            # 링크가 있는 셀 = 대학명
            link = cell.find("a")
            if link:
                univ.name = link.get_text(strip=True)

                # onclick 또는 href에서 파라미터 추출
                onclick = link.get("onclick", "")
                href = link.get("href", "")

                if onclick and onclick != "javascript:void(0)":
                    univ.onclick_params = self._extract_onclick_params(onclick)
                elif href and "Ratio" in href:
                    univ.onclick_params = self._extract_onclick_params(href)
                    univ.ratio_url = href

                # URL 생성
                if not univ.ratio_url and univ.onclick_params:
                    univ.ratio_url = self._generate_ratio_url(univ.onclick_params)
                    univ.univ_code = univ.onclick_params.get("univ_code")
                    univ.type_code = univ.onclick_params.get("type_code")

                continue

            # 상태 확인
            if any(status in text for status in ["준비중", "접수예정", "접수중", "마감"]):
                univ.status = self._parse_status(text)
                continue

            # 기간 확인
            if "~" in text or re.match(r"\d{4}-\d{2}-\d{2}", text):
                univ.period_start, univ.period_end = self._parse_period(text)
                continue

            # 입시구분 확인
            if any(t in text for t in ["정시", "수시", "편입"]):
                univ.admission_type = text
                continue

            # 지역 확인 (첫 번째 셀이 보통 지역)
            if i == 0 and len(text) <= 4:
                univ.region = text

        return univ if univ.name else None

    def _parse_link(self, link) -> Optional[SmartRatioUniversity]:
        """링크 요소에서 대학 정보 추출"""
        name = link.get_text(strip=True)
        if not name or len(name) < 2:
            return None

        univ = SmartRatioUniversity(name=name)

        onclick = link.get("onclick", "")
        href = link.get("href", "")

        if onclick:
            univ.onclick_params = self._extract_onclick_params(onclick)
        if href and "Ratio" in href:
            univ.ratio_url = href
            univ.onclick_params = self._extract_onclick_params(href)

        if not univ.ratio_url and univ.onclick_params:
            univ.ratio_url = self._generate_ratio_url(univ.onclick_params)
            univ.univ_code = univ.onclick_params.get("univ_code")
            univ.type_code = univ.onclick_params.get("type_code")

        return univ

    async def check_url_availability(self, url: str) -> bool:
        """
        경쟁률 페이지 URL 접근 가능 여부 확인

        Returns:
            True if page is accessible and has ratio data
        """
        async with httpx.AsyncClient(headers=self.headers, timeout=10.0) as client:
            try:
                response = await client.get(url)

                if response.status_code != 200:
                    return False

                soup = BeautifulSoup(response.text, "lxml")

                # 경쟁률 테이블 존재 여부 확인
                has_ratio_table = (
                    soup.find("table", class_="tableRatio2") or
                    soup.find("table", class_="tableRatio3") or
                    soup.find(text=re.compile(r"경쟁률|지원인원|모집인원"))
                )

                return bool(has_ratio_table)

            except Exception as e:
                return False

    async def discover_available_urls(
        self,
        universities: list[SmartRatioUniversity],
        max_concurrent: int = 5
    ) -> list[SmartRatioUniversity]:
        """
        대학 목록에서 접근 가능한 URL 찾기

        Args:
            universities: 대학 목록
            max_concurrent: 동시 요청 수

        Returns:
            URL이 확인된 대학 목록
        """
        available = []
        semaphore = asyncio.Semaphore(max_concurrent)

        async def check_single(univ: SmartRatioUniversity):
            async with semaphore:
                if univ.ratio_url:
                    is_available = await self.check_url_availability(univ.ratio_url)
                    if is_available:
                        univ.status = UniversityStatus.OPEN
                        return univ

                # URL이 없거나 접근 불가하면 여러 패턴 시도
                if univ.univ_code:
                    for type_code in ["032", "0321", "0322"]:  # 정시 코드 시도
                        for suffix in ["1", "2", ""]:
                            test_url = f"{self.ratio_base}Ratio{univ.univ_code}{type_code}{suffix}.html"
                            if await self.check_url_availability(test_url):
                                univ.ratio_url = test_url
                                univ.status = UniversityStatus.OPEN
                                return univ
                            await asyncio.sleep(0.1)

                return None

        tasks = [check_single(univ) for univ in universities]
        results = await asyncio.gather(*tasks)

        for result in results:
            if result:
                available.append(result)

        return available

    async def poll_for_availability(
        self,
        check_interval: float = 60.0,
        max_attempts: int = 60,
        callback=None
    ) -> list[SmartRatioUniversity]:
        """
        페이지 오픈까지 주기적으로 확인

        Args:
            check_interval: 확인 간격 (초)
            max_attempts: 최대 시도 횟수
            callback: 진행 상황 콜백 함수

        Returns:
            활성화된 대학 목록
        """
        for attempt in range(max_attempts):
            universities = await self.fetch_university_list()

            if callback:
                callback(f"시도 {attempt + 1}/{max_attempts}: {len(universities)}개 대학 확인 중...")

            available = await self.discover_available_urls(universities[:5])  # 샘플 먼저 확인

            if available:
                if callback:
                    callback(f"페이지 오픈 확인! {len(available)}개 대학 활성화")

                # 전체 대학 확인
                all_available = await self.discover_available_urls(universities)
                return all_available

            if callback:
                callback(f"아직 준비 중... {check_interval}초 후 재확인")

            await asyncio.sleep(check_interval)

        return []


# 편의 함수
async def get_jungsi_universities() -> list[SmartRatioUniversity]:
    """정시 대학 목록 조회"""
    crawler = SmartRatioCrawler()
    return await crawler.fetch_university_list()


async def check_jungsi_pages_open() -> bool:
    """정시 경쟁률 페이지 오픈 여부 확인"""
    crawler = SmartRatioCrawler()
    universities = await crawler.fetch_university_list()

    if not universities:
        return False

    available = await crawler.discover_available_urls(universities[:3])
    return len(available) > 0
