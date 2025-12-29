"""
2025 정시 실제컷 데이터 임포트 스크립트
엑셀 파일: Upload/2025정시-실제컷-정리.xlsx
"""
import pandas as pd
import sqlite3
from datetime import datetime

DB_PATH = "application_rate.db"

def import_data():
    print("=" * 50)
    print("2025 정시 데이터 임포트 시작")
    print("=" * 50)

    # Read Excel files
    print("\n[1] 엑셀 파일 읽기...")
    main_df = pd.read_excel('Upload/2025정시-실제컷-정리.xlsx', sheet_name=0, header=1)
    region_df = pd.read_excel('Upload/2025정시-실제컷-정리.xlsx', sheet_name='Sheet1')

    # Rename columns for main data
    main_df.columns = ['대학코드', '대학명', '구분', '모집단위', '모집인원', '경쟁률',
                       '충원합격순위', '환산점수50', '환산점수70', '총점수능',
                       '백분위50_국', '백분위50_수', '백분위50_탐1', '백분위50_탐2',
                       '백분위50_영', '백분위50_한', '백분위50_평균',
                       '백분위70_국', '백분위70_수', '백분위70_탐1', '백분위70_탐2',
                       '백분위70_영', '백분위70_한', '백분위70_평균']

    # Filter out header rows (where 대학코드 is NaN or not starting with 'U')
    main_df = main_df[main_df['대학코드'].notna()]
    main_df = main_df[main_df['대학코드'].astype(str).str.startswith('U')]

    print(f"  - 메인 데이터: {len(main_df)}건")

    # Create region mapping from Sheet1
    region_mapping = {}
    for _, row in region_df.iterrows():
        code = row['코드명']
        region = row['거시지역']
        if pd.notna(code) and pd.notna(region):
            region_mapping[code] = region
    print(f"  - 지역 매핑: {len(set(region_mapping.keys()))}개 대학")

    # Connect to DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Clear existing data
        print("\n[2] 기존 데이터 정리...")
        cursor.execute("DELETE FROM departments")
        cursor.execute("DELETE FROM admissions")
        cursor.execute("DELETE FROM universities")
        conn.commit()
        print("  - 기존 데이터 삭제 완료")

        # Get unique universities
        print("\n[3] 대학 데이터 생성...")
        universities = main_df[['대학코드', '대학명']].drop_duplicates()
        univ_map = {}  # code -> id

        for _, row in universities.iterrows():
            code = str(row['대학코드'])
            name = str(row['대학명'])
            region = region_mapping.get(code, '')

            cursor.execute("""
                INSERT INTO universities (code, name, region, type, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (code, name, region, '4년제', datetime.now().isoformat()))
            univ_map[code] = cursor.lastrowid

        conn.commit()
        print(f"  - {len(univ_map)}개 대학 생성 완료")

        # Create admissions (정시 가군/나군/다군)
        print("\n[4] 전형 데이터 생성...")
        admission_map = {}  # (univ_code, 군) -> id

        for code, univ_id in univ_map.items():
            for group in ['가군', '나군', '다군']:
                cursor.execute("""
                    INSERT INTO admissions (university_id, admission_type, admission_name, year, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (univ_id, '정시', group, 2025, datetime.now().isoformat()))
                admission_map[(code, group)] = cursor.lastrowid

        conn.commit()
        print(f"  - {len(admission_map)}개 전형 생성 완료")

        # Create departments
        print("\n[5] 학과 데이터 생성...")
        dept_count = 0
        skipped = 0

        for _, row in main_df.iterrows():
            code = str(row['대학코드'])
            group = str(row['구분'])
            dept_name = str(row['모집단위'])

            # Skip if group not in 가군/나군/다군
            if group not in ['가군', '나군', '다군']:
                skipped += 1
                continue

            # Get admission
            key = (code, group)
            if key not in admission_map:
                skipped += 1
                continue

            admission_id = admission_map[key]

            # Parse values
            recruit = int(row['모집인원']) if pd.notna(row['모집인원']) else 0
            rate = float(row['경쟁률']) if pd.notna(row['경쟁률']) else 0.0
            apply_count = int(recruit * rate) if recruit > 0 else 0

            cursor.execute("""
                INSERT INTO departments (admission_id, name, recruit_count, apply_count, competition_rate, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (admission_id, dept_name, recruit, apply_count, rate, datetime.now().isoformat()))
            dept_count += 1

            # Batch commit
            if dept_count % 1000 == 0:
                conn.commit()
                print(f"  - {dept_count}건 처리 중...")

        conn.commit()
        print(f"  - {dept_count}개 학과 생성 완료 (스킵: {skipped}건)")

        # Summary
        print("\n" + "=" * 50)
        print("임포트 완료!")
        print("=" * 50)

        # Verify
        cursor.execute("SELECT COUNT(*) FROM universities")
        total_univ = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM admissions")
        total_admission = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM departments")
        total_dept = cursor.fetchone()[0]

        print(f"\n[최종 통계]")
        print(f"  - 대학: {total_univ}개")
        print(f"  - 전형: {total_admission}개")
        print(f"  - 학과: {total_dept}개")

        # Sample data
        print(f"\n[샘플 데이터]")
        cursor.execute("""
            SELECT u.name, a.admission_name, d.name, d.competition_rate
            FROM departments d
            JOIN admissions a ON d.admission_id = a.id
            JOIN universities u ON a.university_id = u.id
            LIMIT 5
        """)
        for row in cursor.fetchall():
            print(f"  - {row[0]} ({row[1]}) {row[2]}: {row[3]}:1")

        # 군별 통계
        print(f"\n[군별 학과 수]")
        cursor.execute("""
            SELECT a.admission_name, COUNT(d.id) as cnt
            FROM departments d
            JOIN admissions a ON d.admission_id = a.id
            GROUP BY a.admission_name
        """)
        for row in cursor.fetchall():
            print(f"  - {row[0]}: {row[1]}개")

    except Exception as e:
        conn.rollback()
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    import_data()
