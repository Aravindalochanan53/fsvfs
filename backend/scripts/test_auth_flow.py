import urllib.request
import urllib.error
import json

def test_api():
    base = 'http://127.0.0.1:8000'
    print('=== TEST 1: Docs & OpenAPI Specification ===')
    req = urllib.request.Request(f'{base}/docs')
    with urllib.request.urlopen(req) as resp:
        print(f'/docs status (after redirect): {resp.status}, final url: {resp.geturl()}')

    req = urllib.request.Request(f'{base}/api/docs')
    with urllib.request.urlopen(req) as resp:
        print(f'/api/docs status: {resp.status}')

    req = urllib.request.Request(f'{base}/api/openapi.json')
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        has_login = '/api/auth/faculty/login' in data.get('paths', {})
        has_consolidate = '/api/consolidate/summary' in data.get('paths', {})
        print(f'OpenAPI has /api/auth/faculty/login: {has_login}')
        print(f'OpenAPI has /api/consolidate/summary: {has_consolidate}')

    print('\n=== TEST 2: Valid Teacher Login ===')
    login_data = json.dumps({'roll_number': 'KECFAC101', 'password': 'password123'}).encode()
    req = urllib.request.Request(
        f'{base}/api/auth/faculty/login',
        data=login_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    token = None
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode())
        token = body.get('access_token')
        role = body.get('role')
        user = body.get('user', {})
        print(f'Login HTTP status: {resp.status}')
        print(f'Role: {role}')
        print(f'User: {user.get("name")}, Dept: {user.get("department")}')
        print(f'JWT Token received: {bool(token)}')

    print('\n=== TEST 3: Invalid Credentials ===')
    bad_data = json.dumps({'roll_number': 'KECFAC101', 'password': 'WrongPassword999'}).encode()
    req = urllib.request.Request(
        f'{base}/api/auth/faculty/login',
        data=bad_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        urllib.request.urlopen(req)
        print('UNEXPECTED: Login succeeded with bad password')
    except urllib.error.HTTPError as e:
        print(f'Correctly rejected invalid credentials with HTTP {e.code}')
        print(f'Error detail: {e.read().decode()}')

    print('\n=== TEST 4: Missing Credentials ===')
    missing_data = json.dumps({'roll_number': 'KECFAC101'}).encode()
    req = urllib.request.Request(
        f'{base}/api/auth/faculty/login',
        data=missing_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        urllib.request.urlopen(req)
        print('UNEXPECTED: Login succeeded with missing password')
    except urllib.error.HTTPError as e:
        print(f'Correctly rejected missing credentials with HTTP {e.code}')
        print(f'Error detail: {e.read().decode()}')

    print('\n=== TEST 5: Protected Route Without Auth Token ===')
    req = urllib.request.Request(f'{base}/api/consolidate/summary')
    try:
        urllib.request.urlopen(req)
        print('UNEXPECTED: Access granted without token')
    except urllib.error.HTTPError as e:
        print(f'Correctly blocked unauthenticated access with HTTP {e.code}')

    print('\n=== TEST 6: Protected Route With Teacher Token ===')
    req = urllib.request.Request(
        f'{base}/api/consolidate/summary',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode())
        print(f'Consolidate summary HTTP status: {resp.status}')
        print(f'Scope: {body.get("scope")}')
        print(f'Metrics: {body.get("metrics")}')
        print(f'Total records returned: {len(body.get("records", []))}')

    print('\n=== TEST 7: Vite Proxy Routing (port 5173 -> 8000) ===')
    try:
        proxy_req = urllib.request.Request(
            'http://localhost:5173/api/auth/faculty/login',
            data=login_data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(proxy_req) as resp:
            body = json.loads(resp.read().decode())
            print(f'Vite proxy login HTTP status: {resp.status}')
            print(f'Vite proxy token received: {bool(body.get("access_token"))}')
    except Exception as e:
        print(f'Vite proxy test note: {e}')

if __name__ == '__main__':
    test_api()
