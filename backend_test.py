#!/usr/bin/env python3
"""
BooMap Backend API Test Suite - NEW ENDPOINTS + BUG FIX VERIFICATION
Tests: Route sharing, Track, Stats, Weather, Mongo connection race fix
"""
import requests
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://halloween-map.preview.emergentagent.com/api"
DEMO_EMAIL = "demo@boomap.ca"
DEMO_PASSWORD = "BooDemo2025!"

# Global token storage
demo_token = None

def login_demo_user():
    """Login as demo user and get token"""
    global demo_token
    print("\n=== LOGIN: demo@boomap.ca ===")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        if 'token' not in data:
            print(f"❌ FAILED: No token in response")
            return False
        
        demo_token = data['token']
        print(f"✅ PASSED: Logged in successfully, token obtained")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_mongo_connection_race():
    """BUG FIX VERIFICATION: Test Mongo connection race fix with concurrent cold-start requests"""
    print("\n=== BUG FIX: Mongo Connection Race (5 concurrent requests) ===")
    print("Testing: Restart nextjs, then fire 5 concurrent GET /api/listings/public")
    print("Expected: ALL must return 200 (no 500 'Cannot read properties of undefined')")
    
    try:
        # Restart nextjs
        import subprocess
        print("\nRestarting nextjs service...")
        result = subprocess.run(
            ["sudo", "supervisorctl", "restart", "nextjs"],
            capture_output=True,
            text=True,
            timeout=10
        )
        print(f"Restart output: {result.stdout}")
        
        # Wait for service to start
        print("Waiting 10 seconds for service to initialize...")
        time.sleep(10)
        
        # Fire 5 concurrent requests
        print("\nFiring 5 concurrent requests...")
        
        def make_request(i):
            try:
                start = time.time()
                response = requests.get(f"{BASE_URL}/listings/public", timeout=15)
                elapsed = time.time() - start
                return {
                    'request_num': i,
                    'status': response.status_code,
                    'elapsed': elapsed,
                    'success': response.status_code == 200,
                    'error': response.json().get('error') if response.status_code != 200 else None
                }
            except Exception as e:
                return {
                    'request_num': i,
                    'status': 'exception',
                    'elapsed': 0,
                    'success': False,
                    'error': str(e)
                }
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request, i) for i in range(1, 6)]
            results = [future.result() for future in as_completed(futures)]
        
        # Sort by request number for display
        results.sort(key=lambda x: x['request_num'])
        
        # Display results
        print("\nResults:")
        for r in results:
            status_str = "✅" if r['success'] else "❌"
            print(f"  Request {r['request_num']}: {status_str} Status={r['status']}, Time={r['elapsed']:.2f}s, Error={r['error']}")
        
        # Check if all succeeded
        all_success = all(r['success'] for r in results)
        
        if all_success:
            print(f"\n✅ PASSED: All 5 concurrent requests returned 200 (no race condition)")
            return True
        else:
            failed_count = sum(1 for r in results if not r['success'])
            print(f"\n❌ FAILED: {failed_count}/5 requests failed (race condition still present)")
            return False
            
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_listings_public_get_ids():
    """Get public listing IDs for use in other tests"""
    print("\n=== GET: /api/listings/public (fetch listing IDs) ===")
    try:
        response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False, []
        
        data = response.json()
        
        # API returns {listings: [...], server_time: ...}
        if isinstance(data, dict) and 'listings' in data:
            listings = data['listings']
        elif isinstance(data, list):
            listings = data
        else:
            print(f"❌ FAILED: Unexpected response format")
            return False, []
        
        if not isinstance(listings, list) or len(listings) < 2:
            print(f"❌ FAILED: Need at least 2 listings, got {len(listings) if isinstance(listings, list) else 0}")
            return False, []
        
        ids = [l['id'] for l in listings[:2]]
        print(f"✅ PASSED: Got {len(listings)} listings, using IDs: {ids}")
        return True, ids
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False, []


def test_route_share_create(listing_ids):
    """Test POST /api/routes/share"""
    print("\n=== POST: /api/routes/share ===")
    try:
        response = requests.post(
            f"{BASE_URL}/routes/share",
            json={"house_ids": listing_ids},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
        
        data = response.json()
        
        if 'id' not in data:
            print(f"❌ FAILED: Missing 'id' field in response")
            return False, None
        
        share_id = data['id']
        
        if not isinstance(share_id, str) or len(share_id) != 8:
            print(f"❌ FAILED: Expected 8-char string id, got {share_id}")
            return False, None
        
        print(f"✅ PASSED: Created shared route with id={share_id}")
        return True, share_id
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False, None


def test_route_share_get(share_id, expected_ids):
    """Test GET /api/routes/shared?id="""
    print("\n=== GET: /api/routes/shared?id={share_id} ===")
    try:
        response = requests.get(
            f"{BASE_URL}/routes/shared?id={share_id}",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if 'house_ids' not in data:
            print(f"❌ FAILED: Missing 'house_ids' field in response")
            return False
        
        house_ids = data['house_ids']
        
        if house_ids != expected_ids:
            print(f"❌ FAILED: Expected house_ids={expected_ids}, got {house_ids}")
            return False
        
        print(f"✅ PASSED: Retrieved shared route with correct house_ids (order preserved)")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_share_get_nonexistent():
    """Test GET /api/routes/shared?id=nonexistent → 404"""
    print("\n=== GET: /api/routes/shared?id=nonexistent ===")
    try:
        response = requests.get(
            f"{BASE_URL}/routes/shared?id=nonexistent",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 404:
            print(f"❌ FAILED: Expected 404, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'not_found':
            print(f"❌ FAILED: Expected error='not_found', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly returned 404 for nonexistent share id")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_share_empty_array():
    """Test POST /api/routes/share with empty array → 400"""
    print("\n=== POST: /api/routes/share (empty array) ===")
    try:
        response = requests.post(
            f"{BASE_URL}/routes/share",
            json={"house_ids": []},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'no_houses':
            print(f"❌ FAILED: Expected error='no_houses', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected empty house_ids array with 400")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_share_fake_ids():
    """Test POST /api/routes/share with only fake IDs → 404"""
    print("\n=== POST: /api/routes/share (fake IDs) ===")
    try:
        response = requests.post(
            f"{BASE_URL}/routes/share",
            json={"house_ids": ["fake-id-1", "fake-id-2"]},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 404:
            print(f"❌ FAILED: Expected 404, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'houses_not_found':
            print(f"❌ FAILED: Expected error='houses_not_found', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected fake IDs with 404")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_track_route_add(listing_id):
    """Test POST /api/track with metric='route_add'"""
    print("\n=== POST: /api/track (metric=route_add) ===")
    try:
        response = requests.post(
            f"{BASE_URL}/track",
            json={"listing_id": listing_id, "metric": "route_add"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if data.get('ok') != True:
            print(f"❌ FAILED: Expected ok=true, got {data}")
            return False
        
        print(f"✅ PASSED: Track route_add successful")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_track_invalid_metric():
    """Test POST /api/track with invalid metric → 400"""
    print("\n=== POST: /api/track (invalid metric) ===")
    try:
        response = requests.post(
            f"{BASE_URL}/track",
            json={"listing_id": "some-id", "metric": "invalid_metric"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'invalid_metric':
            print(f"❌ FAILED: Expected error='invalid_metric', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected invalid metric with 400")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_stats_with_auth():
    """Test GET /api/listings/stats with Bearer token"""
    print("\n=== GET: /api/listings/stats (with auth) ===")
    try:
        if not demo_token:
            print(f"❌ FAILED: No demo token available")
            return False
        
        response = requests.get(
            f"{BASE_URL}/listings/stats",
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ['minutes_live_today', 'route_adds', 'neighbors_green_nearby', 'green_total', 'reports_open']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing field '{field}' in response")
                return False
            
            if not isinstance(data[field], (int, float)) or data[field] < 0:
                print(f"❌ FAILED: Field '{field}' should be non-negative number, got {data[field]}")
                return False
        
        print(f"✅ PASSED: Stats returned correctly - minutes_live_today={data['minutes_live_today']}, route_adds={data['route_adds']}, neighbors_green_nearby={data['neighbors_green_nearby']}, green_total={data['green_total']}, reports_open={data['reports_open']}")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_stats_without_auth():
    """Test GET /api/listings/stats without token → 401"""
    print("\n=== GET: /api/listings/stats (without auth) ===")
    try:
        response = requests.get(
            f"{BASE_URL}/listings/stats",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ FAILED: Expected 401, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'unauthorized':
            print(f"❌ FAILED: Expected error='unauthorized', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected request without auth with 401")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_weather_valid_coords():
    """Test GET /api/weather?lat=45.52&lng=-73.58"""
    print("\n=== GET: /api/weather?lat=45.52&lng=-73.58 ===")
    print("NOTE: Open-Meteo may return 429 (quota), falls back to MET Norway")
    try:
        response = requests.get(
            f"{BASE_URL}/weather?lat=45.52&lng=-73.58",
            timeout=15
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        required_fields = ['target_date', 'is_halloween', 'tmin', 'tmax', 'precip_prob', 'wind', 'emoji', 'attribution']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing field '{field}' in response")
                return False
        
        # Validate attribution (either Open-Meteo or MET Norway)
        attribution = data['attribution']
        if 'Open-Meteo' not in attribution and 'MET Norway' not in attribution:
            print(f"❌ FAILED: Unexpected attribution: {attribution}")
            return False
        
        print(f"✅ PASSED: Weather data returned - target_date={data['target_date']}, is_halloween={data['is_halloween']}, tmin={data['tmin']}, tmax={data['tmax']}, precip_prob={data['precip_prob']}, wind={data['wind']}, emoji={data['emoji']}, attribution='{attribution}'")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_weather_cache():
    """Test GET /api/weather with same coords (should be fast from cache)"""
    print("\n=== GET: /api/weather (cache test) ===")
    try:
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/weather?lat=45.52&lng=-73.58",
            timeout=10
        )
        elapsed = time.time() - start
        
        print(f"Status: {response.status_code}, Time: {elapsed:.3f}s")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        # Cache should make it fast (< 1s typically)
        if elapsed < 2.0:
            print(f"✅ PASSED: Fast response ({elapsed:.3f}s), likely from cache")
        else:
            print(f"⚠️  WARNING: Slow response ({elapsed:.3f}s), cache may not be working")
        
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_weather_invalid_coords():
    """Test GET /api/weather with invalid coords → 400"""
    print("\n=== GET: /api/weather?lat=999&lng=0 (invalid) ===")
    try:
        response = requests.get(
            f"{BASE_URL}/weather?lat=999&lng=0",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'invalid_coords':
            print(f"❌ FAILED: Expected error='invalid_coords', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected invalid coords with 400")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_listings_override_null():
    """Test PATCH /api/listings/override with override=null (auto mode)"""
    print("\n=== PATCH: /api/listings/override (override=null) ===")
    try:
        if not demo_token:
            print(f"❌ FAILED: No demo token available")
            return False
        
        response = requests.patch(
            f"{BASE_URL}/listings/override",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"override": None},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if 'listing' not in data:
            print(f"❌ FAILED: Missing 'listing' field in response")
            return False
        
        listing = data['listing']
        
        # Check that manual_override is null
        if listing.get('manual_override') is not None:
            print(f"❌ FAILED: Expected manual_override=null, got {listing.get('manual_override')}")
            return False
        
        print(f"✅ PASSED: Override set to null (auto mode), status={listing.get('status')}")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def main():
    print("=" * 80)
    print("BooMap Backend Test Suite - NEW ENDPOINTS + BUG FIX VERIFICATION")
    print("=" * 80)
    
    results = []
    
    # 1. BUG FIX VERIFICATION: Mongo connection race
    results.append(("BUG FIX: Mongo connection race (5 concurrent requests)", test_mongo_connection_race()))
    
    # 2. Login to get token for authenticated endpoints
    if not login_demo_user():
        print("\n❌ CRITICAL: Failed to login, cannot test authenticated endpoints")
        sys.exit(1)
    
    # 3. Get listing IDs for route sharing tests
    success, listing_ids = test_listings_public_get_ids()
    results.append(("GET /api/listings/public (fetch IDs)", success))
    
    if not success or len(listing_ids) < 2:
        print("\n❌ CRITICAL: Failed to get listing IDs, cannot test route sharing")
        sys.exit(1)
    
    # 4. Route sharing tests
    success, share_id = test_route_share_create(listing_ids)
    results.append(("POST /api/routes/share (create)", success))
    
    if success and share_id:
        results.append(("GET /api/routes/shared?id={id}", test_route_share_get(share_id, listing_ids)))
    
    results.append(("GET /api/routes/shared?id=nonexistent → 404", test_route_share_get_nonexistent()))
    results.append(("POST /api/routes/share (empty array) → 400", test_route_share_empty_array()))
    results.append(("POST /api/routes/share (fake IDs) → 404", test_route_share_fake_ids()))
    
    # 5. Track tests
    results.append(("POST /api/track (route_add)", test_track_route_add(listing_ids[0])))
    results.append(("POST /api/track (invalid metric) → 400", test_track_invalid_metric()))
    
    # 6. Stats tests
    results.append(("GET /api/listings/stats (with auth)", test_stats_with_auth()))
    results.append(("GET /api/listings/stats (without auth) → 401", test_stats_without_auth()))
    
    # 7. Weather tests
    results.append(("GET /api/weather (valid coords)", test_weather_valid_coords()))
    results.append(("GET /api/weather (cache test)", test_weather_cache()))
    results.append(("GET /api/weather (invalid coords) → 400", test_weather_invalid_coords()))
    
    # 8. Quick sanity: override
    results.append(("PATCH /api/listings/override (null)", test_listings_override_null()))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
