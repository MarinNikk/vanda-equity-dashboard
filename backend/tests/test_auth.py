"""Auth flow: the access gate, credential checks, and the login/logout lifecycle."""


def test_protected_routes_require_auth(client, fresh_cookies):
    assert client.get("/api/symbols").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_login_wrong_password_401(client, test_user, fresh_cookies):
    resp = client.post(
        "/api/auth/login",
        json={"username": test_user["username"], "password": "wrong"},
    )
    assert resp.status_code == 401


def test_login_unknown_user_401(client, fresh_cookies):
    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
    assert resp.status_code == 401


def test_login_me_logout_flow(client, test_user, fresh_cookies):
    resp = client.post("/api/auth/login", json=test_user)
    assert resp.status_code == 200
    assert resp.json()["username"] == test_user["username"]
    assert "vanda_session" in resp.cookies  # session cookie was set

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == test_user["username"]

    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401  # session is dead
