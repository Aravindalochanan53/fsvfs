import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000/api"

def make_req(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"raw": err_body}

def test_strict_attendance_and_reports():
    print("=" * 70)
    print("RUNNING STRICT ATTENDANCE & REPORT WORKFLOW TEST SUITE")
    print("=" * 70)

    # 1. Login student Aarav Krishnan (21CSR001)
    code, res = make_req("/auth/student/login", "POST", {"roll_number": "21CSR001", "password": "password123"})
    assert code == 200, f"Student login failed: {res}"
    stu_token = res["access_token"]
    stu_user = res["user"]
    print(f"[1] Student Login: {stu_user['student_name']} (Dept: {stu_user['department']})")

    # 2. Login faculty Dr. S. Radhakrishnan (KECFAC101)
    code, res = make_req("/auth/faculty/login", "POST", {"roll_number": "KECFAC101", "password": "password123"})
    assert code == 200, f"Faculty login failed: {res}"
    fac_token = res["access_token"]
    fac_user = res["user"]
    print(f"[2] Faculty Login: {fac_user['faculty_name']} (Dept: {fac_user['department']})")

    # 3. Today attendance status
    code, today_res = make_req("/attendance/today", token=stu_token)
    assert code == 200
    print(f"[3] Attendance Today Status: Checked in={today_res['checked_in']}, Checked out={today_res['checked_out']}")

    # 4. Check-in or Check Lock
    # Company is Zoho Corp (12.8333, 80.0489)
    if not today_res["checked_in"]:
        code, ci_res = make_req("/attendance/check-in", "POST", {
            "lat": 12.8333,
            "lng": 80.0489,
            "accuracy": 15.0,
            "device_info": "Chrome / Windows 11"
        }, token=stu_token)
        print(f"[4] Check-in Result: Status {code} => {ci_res.get('status')}")
        assert code == 200
        assert ci_res["status"] == "Checked In / Pending Completion"
    else:
        print("[4] Already checked in earlier today. Testing Daily Check-in Lock enforcement...")

    # 5. Strict Lock: Second check-in attempt MUST fail with 400
    code, lock_res = make_req("/attendance/check-in", "POST", {
        "lat": 12.8333,
        "lng": 80.0489,
        "accuracy": 12.0
    }, token=stu_token)
    print(f"[5] Duplicate Check-in Attempt: Status {code} => Expected 400 Locked")
    assert code == 400, f"Expected 400 for duplicate check-in, got {code}"
    print(f"    Lock message: {lock_res.get('detail')}")

    # 6. Verify Attendance Stats (only verified present counts)
    code, stats_res = make_req("/attendance/stats", token=stu_token)
    assert code == 200
    stats = stats_res["stats"]
    print(f"[6] Attendance Stats: Rate={stats['attendance_pct']}%, Present={stats['present_days']}, HalfDays={stats['half_days']}, Incomplete={stats['incomplete_days']}")

    # 7. Faculty Alerts Stream
    code, alerts_res = make_req("/attendance/alerts", token=fac_token)
    assert code == 200
    print(f"[7] Faculty Department Alerts: {alerts_res.get('total_alerts')} alerts returned for {alerts_res.get('department')}")

    # 8. Faculty Correction Workflow (with mandatory reason)
    # Correct attendance record ID 1 with reason
    code, corr_res = make_req("/attendance/correct", "POST", {
        "attendance_id": 1,
        "new_status": "Present / Verified",
        "new_working_hours": 8.0,
        "reason": "Verified on-site visit by faculty mentor Dr. S. Radhakrishnan"
    }, token=fac_token)
    assert code == 200, f"Faculty correction failed: {corr_res}"
    print(f"[8] Faculty Attendance Correction: Status {code} => {corr_res.get('message')}")

    # 9. Audit Trail Verification
    code, audit_res = make_req("/attendance/audit-logs", token=fac_token)
    assert code == 200
    print(f"[9] Immutable Audit Logs: {audit_res.get('total')} audit entries recorded")
    assert audit_res.get("total") > 0
    latest_log = audit_res["audit_logs"][0]
    print(f"    Latest action: {latest_log['action']} by {latest_log['performed_by_name']} (Reason: {latest_log['reason']})")

    # 10. Internship Report Workflow: Get My Report
    code, rep_res = make_req("/reports/my", token=stu_token)
    assert code == 200
    print(f"[10] Student Report: Completion={rep_res.get('completion_pct')}%, Status={rep_res.get('status')}, Missing Sections={len(rep_res.get('missing_sections', []))}")

    # 11. Save Report Draft
    sections = rep_res["sections_data"]
    sections["abstract"] = "This is a comprehensive executive summary of the cloud engineering internship at Zoho Corporation."
    sections["problem_statement"] = "Designing high-throughput distributed microservices for real-time document sync."
    sections["work_completed"] = "Built RESTful endpoints with FastAPI, implemented caching with Redis, and authored unit tests."
    sections["technologies_used"] = "Python 3.12, FastAPI, SQLAlchemy, MSSQL Server, React 19, Docker, Git"
    sections["skills_outcomes"] = "Learned distributed transaction coordination, geofencing algorithms, and database indexing."

    code, draft_res = make_req("/reports/draft", "POST", {
        "sections_data": sections,
        "change_summary": "Added abstract, problem statement, work completed, and skills"
    }, token=stu_token)
    assert code == 200, f"Save draft failed: {draft_res}"
    print(f"[11] Save Report Draft: Status {code} => Version {draft_res.get('version')}, Completion: {draft_res.get('completion_pct')}%")

    # 12. View Version History
    code, ver_res = make_req("/reports/versions", token=stu_token)
    assert code == 200
    print(f"[12] Report Version History: {ver_res.get('total_versions')} versions recorded")

    # 13. Faculty Review List
    code, rev_list_res = make_req("/reports/review-list", token=fac_token)
    assert code == 200
    print(f"[13] Faculty Review Queue: {rev_list_res.get('total_reports')} reports available for review in {rev_list_res.get('department')}")

    # 14. Faculty Review & Feedback
    rep_id = rep_res["report_id"]
    code, rev_res = make_req("/reports/review", "POST", {
        "report_id": rep_id,
        "decision": "Changes Requested",
        "feedback": "Please elaborate on Chapter 4 System Architecture diagram and include screenshot evidence.",
        "unlocked_sections": ["system_methodology", "evidence_screenshots"]
    }, token=fac_token)
    assert code == 200, f"Review failed: {rev_res}"
    print(f"[14] Faculty Review Action: {rev_res.get('message')}")

    # 15. Student verifies unlocked sections after review
    code, rep_check = make_req("/reports/my", token=stu_token)
    assert code == 200
    print(f"[15] Student Checked Report: Status={rep_check.get('status')}, Feedback={rep_check.get('faculty_feedback')}")
    print(f"     Unlocked Sections for Editing: {rep_check.get('unlocked_sections')}")
    assert rep_check.get("status") == "Changes Requested"
    assert "system_methodology" in rep_check.get("unlocked_sections", [])

    print("=" * 70)
    print("ALL 15 STRICT ATTENDANCE & REPORT WORKFLOW TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    test_strict_attendance_and_reports()
