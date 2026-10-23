import sys
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import database
from bson import ObjectId

client = TestClient(app)

print("Starting backend test suite...")

# 1. Test Seed Questions
titles = [
    'Two Sum', 'Longest Substring Without Repeating Characters',
    'Trapping Rain Water', 'Contains Duplicate', 'Valid Parentheses',
    'Group Anagrams', '3Sum', 'Number of Islands', 'Merge k Sorted Lists',
    'Minimum Window Substring'
]
q_col = database["questions"]
found_count = q_col.count_documents({"title": {"$in": titles}})
assert found_count == 10, f"Expected 10 seeded questions, found {found_count}"
print(f"PASS: 10 Seeded questions verified in MongoDB ({found_count}/10)")

# 2. Get existing test user
test_user = database["users"].find_one()
assert test_user is not None, "A test user must exist in database"
user_id = str(test_user["_id"])
print(f"Using test user: {test_user['email']} (id: {user_id})")

# Mock session in auth_sessions
from app.services.auth_service import create_session
token, _ = create_session(user_id)
client.cookies.set("tracker_session", token)

# 3. Test list questions
res = client.get("/api/v1/dsa/questions?limit=5")
assert res.status_code == 200, f"list questions failed: {res.text}"
q_data = res.json()
assert len(q_data) > 0, "Expected non-empty questions list"
print(f"PASS: GET /dsa/questions returned {len(q_data)} items")

# 4. Test Add, Edit, Delete Question
new_q = {
    "title": "Automated Test Question",
    "url": "https://leetcode.com/problems/automated-test-question/",
    "difficulty": "medium",
    "platform": "leetcode",
    "platform_id": "automated-test-question",
    "topics": ["Testing", "Arrays"],
    "frequency_score": 7
}
res = client.post("/api/v1/dsa/questions", json=new_q)
assert res.status_code == 201, f"create question failed: {res.text}"
created_q = res.json()
created_id = created_q["id"]
assert created_q["title"] == "Automated Test Question"
print(f"PASS: POST /dsa/questions created question ID: {created_id}")

# Edit question
res = client.put(f"/api/v1/dsa/questions/{created_id}", json={"difficulty": "hard", "frequency_score": 9})
assert res.status_code == 200, f"update question failed: {res.text}"
assert res.json()["difficulty"] == "hard"
assert res.json()["frequency_score"] == 9
print(f"PASS: PUT /dsa/questions/{created_id} updated difficulty and frequency")

# Record attempts (Solved, Retry, Pending)
res = client.post("/api/v1/dsa/attempts", json={"question_id": created_id, "status": "solved"})
assert res.status_code == 200, f"record solved attempt failed: {res.text}"
print("PASS: POST /dsa/attempts recorded 'solved'")

res = client.post("/api/v1/dsa/attempts", json={"question_id": created_id, "status": "failed"})
assert res.status_code == 200, f"record retry attempt failed: {res.text}"
print("PASS: POST /dsa/attempts recorded 'failed' (retry)")

res = client.post("/api/v1/dsa/attempts", json={"question_id": created_id, "status": "pending"})
assert res.status_code == 200, f"reset attempt failed: {res.text}"
print("PASS: POST /dsa/attempts reset to 'pending'")

# Delete question
res = client.delete(f"/api/v1/dsa/questions/{created_id}")
assert res.status_code == 200, f"delete question failed: {res.text}"
print(f"PASS: DELETE /dsa/questions/{created_id} deleted successfully")

# 5. Test DSA Stats and History
res = client.get("/api/v1/dsa/stats")
assert res.status_code == 200, f"get stats failed: {res.text}"
stats = res.json()
assert "current_streak" in stats and "difficulty" in stats
print(f"PASS: GET /dsa/stats returned streak: {stats['current_streak']}, solved: {stats['solved_count']}")

res = client.get("/api/v1/dsa/attempts/history")
assert res.status_code == 200, f"get history failed: {res.text}"
print("PASS: GET /dsa/attempts/history works")

# 6. Test Daily Questions
res = client.get("/api/v1/dsa/daily")
assert res.status_code == 200, f"get daily failed: {res.text}"
daily = res.json()
assert "questions" in daily
print(f"PASS: GET /dsa/daily returned {len(daily['questions'])} daily questions")

# 7. Test Platforms
res = client.get("/api/v1/platforms/supported")
assert res.status_code == 200
print(f"PASS: GET /platforms/supported returned {len(res.json())} platforms")

# Add custom platform
plat_payload = {
    "name": "Custom Test Platform",
    "website": "https://example.com/coder",
    "handle": "test_coder_123",
    "platform_key": "custom",
    "sync_contests": True
}
res = client.post("/api/v1/platforms", json=plat_payload)
assert res.status_code == 201, f"add platform failed: {res.text}"
created_plat = res.json()
plat_id = created_plat["id"]
print(f"PASS: POST /platforms added platform ID: {plat_id}")

res = client.post(f"/api/v1/platforms/{plat_id}/test")
assert res.status_code == 200
print("PASS: POST /platforms/{id}/test validated platform")

# Delete platform
res = client.delete(f"/api/v1/platforms/{plat_id}")
assert res.status_code == 200
print("PASS: DELETE /platforms/{id} cleaned up platform")

# 8. Test Preferences
res = client.get("/api/v1/preferences")
assert res.status_code == 200
print(f"PASS: GET /preferences returned: {res.json().get('daily_target')} daily target")

res = client.put("/api/v1/preferences", json={"daily_target": 5, "calendar_sync_interval_hours": 12})
assert res.status_code == 200
assert res.json()["daily_target"] == 5
assert res.json()["calendar_sync_interval_hours"] == 12
print("PASS: PUT /preferences updated daily_target to 5 and sync interval to 12")

# 9. Test Profile
res = client.get("/api/v1/profile")
assert res.status_code == 200
print(f"PASS: GET /profile returned user: {res.json()['email']}")

res = client.put("/api/v1/profile", json={"target_role": "Senior AI Engineer", "primary_language": "Python"})
assert res.status_code == 200
assert res.json()["target_role"] == "Senior AI Engineer"
print("PASS: PUT /profile updated target_role")

# 10. Test Contests Aggregation
res = client.get("/api/v1/contests?limit=5")
assert res.status_code == 200
assert "contests" in res.json()
print(f"PASS: GET /contests returned {len(res.json()['contests'])} aggregated upcoming contests")

print("\nALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY!")
