"""
엑셀 데이터로 DB 초기화 및 임포트
2025정시-실제컷-정리(지원자,실질경쟁율).xlsx
"""
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./application_rate.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def clear_all_data():
    """모든 데이터 삭제"""
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM ratio_history"))
        conn.execute(text("DELETE FROM departments"))
        conn.execute(text("DELETE FROM admissions"))
        conn.execute(text("DELETE FROM universities"))
        conn.commit()
    print("[OK] 기존 데이터 삭제 완료")

def import_excel_data(excel_path: str):
    """엑셀 데이터 임포트"""
    # 엑셀 읽기 (헤더 2행 건너뛰기)
    df = pd.read_excel(excel_path, engine='openpyxl', skiprows=2)

    # 컬럼 지정
    df.columns = [
        '대학코드', '대학명', '군', '모집단위', '정원', '경쟁률', '추가합격',
        '환산50', '환산70', '총점',
        '국50', '수50', '탐1_50', '탐2_50', '영50', '한50', '백분위평균50',
        '국70', '수70', '탐1_70', '탐2_70', '영70', '한70', '백분위평균70',
        '실질경쟁률', '지원자수'
    ]

    # 유효한 데이터만 필터링
    df = df.dropna(subset=['대학명', '모집단위'])
    print(f"[OK] 엑셀 로드: {len(df)}개 학과")

    session = SessionLocal()
    now = datetime.now()

    # 대학별로 그룹화
    universities = {}
    admissions = {}

    try:
        for _, row in df.iterrows():
            univ_code = str(row['대학코드']).strip()
            univ_name = str(row['대학명']).strip()
            group = str(row['군']).strip()  # 가군/나군/다군
            dept_name = str(row['모집단위']).strip()

            # 정원
            recruit_count = 0
            if pd.notna(row['정원']):
                try:
                    recruit_count = int(row['정원'])
                except:
                    pass

            # 지원자수
            apply_count = 0
            if pd.notna(row['지원자수']):
                try:
                    apply_count = int(row['지원자수'])
                except:
                    pass

            # 경쟁률
            competition_rate = 0.0
            if pd.notna(row['경쟁률']):
                try:
                    competition_rate = float(row['경쟁률'])
                except:
                    pass

            # 추가합격
            additional_recruit = None
            if pd.notna(row['추가합격']):
                try:
                    additional_recruit = int(row['추가합격'])
                except:
                    pass

            # 실질경쟁률
            actual_rate = None
            if pd.notna(row['실질경쟁률']):
                try:
                    actual_rate = float(row['실질경쟁률'])
                except:
                    pass

            # 대학 생성/조회
            if univ_code not in universities:
                result = session.execute(text("""
                    INSERT INTO universities (code, name, region, type, created_at)
                    VALUES (:code, :name, NULL, '4년제', :now)
                """), {'code': univ_code, 'name': univ_name, 'now': now})
                session.flush()

                univ_id = session.execute(text(
                    "SELECT id FROM universities WHERE code = :code"
                ), {'code': univ_code}).fetchone()[0]
                universities[univ_code] = univ_id

            univ_id = universities[univ_code]

            # 입시 (군별) 생성/조회
            admission_key = f"{univ_code}_{group}"
            if admission_key not in admissions:
                session.execute(text("""
                    INSERT INTO admissions (university_id, admission_type, admission_name, year, created_at)
                    VALUES (:univ_id, '정시', :group, 2025, :now)
                """), {'univ_id': univ_id, 'group': group, 'now': now})
                session.flush()

                adm_id = session.execute(text("""
                    SELECT id FROM admissions
                    WHERE university_id = :univ_id AND admission_name = :group
                """), {'univ_id': univ_id, 'group': group}).fetchone()[0]
                admissions[admission_key] = adm_id

            adm_id = admissions[admission_key]

            # 학과 생성
            session.execute(text("""
                INSERT INTO departments (
                    admission_id, campus, name, detail,
                    recruit_count, apply_count, competition_rate,
                    additional_recruit, actual_competition_rate,
                    created_at
                ) VALUES (
                    :adm_id, NULL, :name, NULL,
                    :recruit, :apply, :rate,
                    :additional, :actual,
                    :now
                )
            """), {
                'adm_id': adm_id,
                'name': dept_name,
                'recruit': recruit_count,
                'apply': apply_count,
                'rate': competition_rate,
                'additional': additional_recruit,
                'actual': actual_rate,
                'now': now
            })

        session.commit()
        print(f"[OK] 임포트 완료: {len(universities)}개 대학, {len(df)}개 학과")

    except Exception as e:
        session.rollback()
        print(f"[ERROR] 오류: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    excel_path = r"E:\Dev\github\Application-Rate\Upload\2025정시-실제컷-정리(지원자,실질경쟁율).xlsx"

    print("=== DB 초기화 및 엑셀 임포트 ===\n")

    print("1. 기존 데이터 삭제...")
    clear_all_data()

    print("\n2. 엑셀 데이터 임포트...")
    import_excel_data(excel_path)

    print("\n=== 완료 ===")
