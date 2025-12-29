"""
엑셀 데이터에서 추가모집/실질경쟁률 데이터를 임포트하는 스크립트
"""
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

# 데이터베이스 연결
DATABASE_URL = "sqlite:///./application_rate.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def add_columns_if_not_exist():
    """새 컬럼이 없으면 추가"""
    with engine.connect() as conn:
        # Check if columns exist
        result = conn.execute(text("PRAGMA table_info(departments)"))
        columns = [row[1] for row in result.fetchall()]

        if 'additional_recruit' not in columns:
            conn.execute(text("ALTER TABLE departments ADD COLUMN additional_recruit INTEGER"))
            print("Added additional_recruit column")

        if 'actual_competition_rate' not in columns:
            conn.execute(text("ALTER TABLE departments ADD COLUMN actual_competition_rate FLOAT"))
            print("Added actual_competition_rate column")

        conn.commit()

def import_excel_data(excel_path: str):
    """엑셀 데이터 임포트"""
    # 엑셀 읽기
    df = pd.read_excel(excel_path, engine='openpyxl')

    # 컬럼명 확인 (첫 2행은 헤더)
    df = pd.read_excel(excel_path, engine='openpyxl', skiprows=2)
    df.columns = ['대학코드', '대학명', '구분', '모집단위', '모집인원', '경쟁률', '충원합격순위',
                  '환산점수50', '환산점수70', '총점', '백분위50_국', '백분위50_수', '백분위50_탐1',
                  '백분위50_탐2', '백분위50_영', '백분위50_한', '백분위50_평균',
                  '백분위70_국', '백분위70_수', '백분위70_탐1', '백분위70_탐2',
                  '백분위70_영', '백분위70_한', '백분위70_평균', '실질경쟁율']

    print(f"엑셀 데이터 로드: {len(df)} 행")

    # 유효한 데이터만 필터링
    df = df.dropna(subset=['대학명', '모집단위'])
    print(f"유효 데이터: {len(df)} 행")

    session = SessionLocal()
    updated_count = 0
    not_found_count = 0

    try:
        for _, row in df.iterrows():
            university_name = str(row['대학명']).strip()
            department_name = str(row['모집단위']).strip()

            # 충원합격순위 (추가모집)
            additional_recruit = None
            if pd.notna(row['충원합격순위']):
                try:
                    additional_recruit = int(row['충원합격순위'])
                except (ValueError, TypeError):
                    pass

            # 실질경쟁률
            actual_rate = None
            if pd.notna(row['실질경쟁율']):
                try:
                    actual_rate = float(row['실질경쟁율'])
                except (ValueError, TypeError):
                    pass

            # 데이터베이스에서 매칭되는 학과 찾기
            result = session.execute(text("""
                UPDATE departments
                SET additional_recruit = :additional_recruit,
                    actual_competition_rate = :actual_rate
                WHERE id IN (
                    SELECT d.id FROM departments d
                    JOIN admissions a ON d.admission_id = a.id
                    JOIN universities u ON a.university_id = u.id
                    WHERE u.name = :university_name
                    AND d.name = :department_name
                )
            """), {
                'additional_recruit': additional_recruit,
                'actual_rate': actual_rate,
                'university_name': university_name,
                'department_name': department_name
            })

            if result.rowcount > 0:
                updated_count += result.rowcount
            else:
                not_found_count += 1
                # 비슷한 이름 찾기 시도
                similar = session.execute(text("""
                    SELECT u.name, d.name FROM departments d
                    JOIN admissions a ON d.admission_id = a.id
                    JOIN universities u ON a.university_id = u.id
                    WHERE u.name LIKE :university_pattern
                    AND d.name LIKE :department_pattern
                    LIMIT 3
                """), {
                    'university_pattern': f"%{university_name[:3]}%",
                    'department_pattern': f"%{department_name[:3]}%"
                }).fetchall()

                if not_found_count <= 10:
                    print(f"  매칭 실패: {university_name} - {department_name}")
                    if similar:
                        print(f"    유사: {similar}")

        session.commit()
        print(f"\n완료: {updated_count}개 업데이트, {not_found_count}개 매칭 실패")

    except Exception as e:
        session.rollback()
        print(f"오류: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    excel_path = r"E:\Dev\github\Application-Rate\Upload\2025정시-실제컷-정리(실질경쟁율).xlsx"

    if not os.path.exists(excel_path):
        print(f"엑셀 파일을 찾을 수 없습니다: {excel_path}")
        exit(1)

    print("1. 데이터베이스 컬럼 추가...")
    add_columns_if_not_exist()

    print("\n2. 엑셀 데이터 임포트...")
    import_excel_data(excel_path)
