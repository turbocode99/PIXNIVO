from fastapi.testclient import TestClient
import main
import sys

client = TestClient(main.app)

def test_public_blogs():
    res = client.get("/api/blogs")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    blogs = res.json()
    assert len(blogs) >= 13, f"Expected at least 13 blogs, got {len(blogs)}"
    print(f"PASS: Public blogs listing ok ({len(blogs)} blogs found)")

def test_auth_failure_and_success():
    # Test invalid credentials
    bad_res = client.post("/api/auth/login", json={"username": "admin@pixnivo.app", "password": "WrongPassword123!"})
    assert bad_res.status_code == 401, f"Expected 401, got {bad_res.status_code}"
    print(f"PASS: Bad credentials rejected: {bad_res.json()['detail']}")

    # Test valid credentials
    good_res = client.post("/api/auth/login", json={"username": "admin@pixnivo.app", "password": "PixnivoSecure#2026!"})
    assert good_res.status_code == 200, f"Expected 200, got {good_res.status_code}"
    data = good_res.json()
    assert "token" in data, "Token missing in login response"
    token = data["token"]
    print("PASS: Admin login successful with token")

    # Verify session
    verify_res = client.get("/api/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert verify_res.status_code == 200, f"Expected 200, got {verify_res.status_code}"
    assert verify_res.json()["status"] == "authenticated"
    print("PASS: Session token verification ok")
    return token

def test_blog_crud(token):
    headers = {"Authorization": f"Bearer {token}"}
    test_slug = "test-automated-admin-article"

    # Create blog
    post_payload = {
        "slug": test_slug,
        "title": "Automated Testing of Admin Portal",
        "category": "Testing & QA",
        "author": "Antigravity",
        "excerpt": "This is an automated test blog post to verify end-to-end admin functionality.",
        "content": "<h2>Testing Rich Text</h2><p>Here is content created through automated test.</p>",
        "status": "published"
    }
    create_res = client.post("/api/admin/blogs", json=post_payload, headers=headers)
    assert create_res.status_code == 200, f"Create blog failed: {create_res.text}"
    print(f"PASS: Created blog post '{test_slug}'")

    # Read single blog
    get_res = client.get(f"/api/blogs/{test_slug}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Automated Testing of Admin Portal"
    print("PASS: Read single blog post ok")

    # Update blog
    update_payload = dict(post_payload)
    update_payload["title"] = "Updated Automated Testing of Admin Portal"
    update_res = client.put(f"/api/admin/blogs/{test_slug}", json=update_payload, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated Automated Testing of Admin Portal"
    print("PASS: Updated blog post ok")

    # Delete blog
    del_res = client.delete(f"/api/admin/blogs/{test_slug}", headers=headers)
    assert del_res.status_code == 200
    print("PASS: Deleted blog post ok")

    # Verify gone from public
    gone_res = client.get(f"/api/blogs/{test_slug}")
    assert gone_res.status_code == 404
    print("PASS: Verified blog no longer exists on public endpoint")

if __name__ == "__main__":
    print("Running PIXNIVO Admin API Tests...")
    test_public_blogs()
    tok = test_auth_failure_and_success()
    test_blog_crud(tok)
    print("\nALL BACKEND ADMIN & BLOG TESTS PASSED!")
