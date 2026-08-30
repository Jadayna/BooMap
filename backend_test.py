#!/usr/bin/env python3
"""
BooMap Backend API Test Suite - GET /api/route endpoint
Tests the new Mapbox Directions walking proxy endpoint
"""
import requests
import sys

BASE_URL = "https://halloween-map.preview.emergentagent.com/api"

def test_sanity_check_listings_public():
    """Quick sanity check: GET /api/listings/public should return listings array"""
    print("\n=== SANITY CHECK: GET /api/listings/public ===")
    try:
        response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # API now returns {listings: [...], server_time: ...} instead of just [...]
        if isinstance(data, dict) and 'listings' in data:
            listings = data['listings']
            if not isinstance(listings, list):
                print(f"❌ FAILED: Expected listings to be array, got {type(listings)}")
                return False
            print(f"✅ PASSED: Returned {len(listings)} listings (new format with server_time)")
            return True
        elif isinstance(data, list):
            print(f"✅ PASSED: Returned {len(data)} listings (old format)")
            return True
        else:
            print(f"❌ FAILED: Unexpected response format: {type(data)}")
            return False
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_valid_2_coords():
    """Test 1: Valid 2 coordinate pairs"""
    print("\n=== TEST 1: Valid 2 coords ===")
    try:
        coords = "-73.5817,45.5231;-73.5872,45.5275"
        response = requests.get(f"{BASE_URL}/route?coords={coords}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {data.keys()}")
        
        # Check required fields
        if 'geometry' not in data:
            print(f"❌ FAILED: Missing 'geometry' field")
            return False
        
        if 'distance_m' not in data:
            print(f"❌ FAILED: Missing 'distance_m' field")
            return False
        
        if 'duration_s' not in data:
            print(f"❌ FAILED: Missing 'duration_s' field")
            return False
        
        # Validate geometry structure
        geom = data['geometry']
        if geom.get('type') != 'LineString':
            print(f"❌ FAILED: geometry.type should be 'LineString', got {geom.get('type')}")
            return False
        
        if 'coordinates' not in geom or not isinstance(geom['coordinates'], list):
            print(f"❌ FAILED: geometry.coordinates should be an array")
            return False
        
        # Validate distance and duration are positive integers
        if not isinstance(data['distance_m'], int) or data['distance_m'] <= 0:
            print(f"❌ FAILED: distance_m should be positive int, got {data['distance_m']}")
            return False
        
        if not isinstance(data['duration_s'], int) or data['duration_s'] <= 0:
            print(f"❌ FAILED: duration_s should be positive int, got {data['duration_s']}")
            return False
        
        print(f"✅ PASSED: distance_m={data['distance_m']}, duration_s={data['duration_s']}, coords_count={len(geom['coordinates'])}")
        return data['distance_m']  # Return distance for comparison in test 2
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_valid_3_coords(distance_2_coords):
    """Test 2: Valid 3 coordinate pairs (should have larger distance than 2 coords)"""
    print("\n=== TEST 2: Valid 3 coords ===")
    try:
        coords = "-73.5817,45.5231;-73.5872,45.5275;-73.5936,45.5248"
        response = requests.get(f"{BASE_URL}/route?coords={coords}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check required fields
        if 'geometry' not in data or 'distance_m' not in data or 'duration_s' not in data:
            print(f"❌ FAILED: Missing required fields")
            return False
        
        # Validate distance is larger than 2-coord route
        if isinstance(distance_2_coords, int) and data['distance_m'] <= distance_2_coords:
            print(f"❌ FAILED: 3-coord distance ({data['distance_m']}m) should be larger than 2-coord distance ({distance_2_coords}m)")
            return False
        
        print(f"✅ PASSED: distance_m={data['distance_m']}, duration_s={data['duration_s']} (larger than 2-coord route)")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_only_1_pair():
    """Test 3: Only 1 coordinate pair → 400"""
    print("\n=== TEST 3: Only 1 coord pair ===")
    try:
        coords = "-73.5817,45.5231"
        response = requests.get(f"{BASE_URL}/route?coords={coords}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'invalid_coords':
            print(f"❌ FAILED: Expected error='invalid_coords', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected 1 coord pair with 400 invalid_coords")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_too_many_pairs():
    """Test 4: 13 coordinate pairs (too many) → 400"""
    print("\n=== TEST 4: 13 coord pairs (too many) ===")
    try:
        # Generate 13 coordinate pairs
        coords = ";".join([f"-73.{5800+i},45.{5200+i}" for i in range(13)])
        response = requests.get(f"{BASE_URL}/route?coords={coords}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'invalid_coords':
            print(f"❌ FAILED: Expected error='invalid_coords', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected 13 coord pairs with 400 invalid_coords")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_garbage_coords():
    """Test 5: Garbage coords → 400"""
    print("\n=== TEST 5: Garbage coords ===")
    try:
        coords = "bad"
        response = requests.get(f"{BASE_URL}/route?coords={coords}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'invalid_coords':
            print(f"❌ FAILED: Expected error='invalid_coords', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected garbage coords with 400 invalid_coords")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_out_of_range_coords():
    """Test 6: Out-of-range coords → 400"""
    print("\n=== TEST 6: Out-of-range coords ===")
    try:
        coords = "200,95;10,10"
        response = requests.get(f"{BASE_URL}/route?coords={coords}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'invalid_coords':
            print(f"❌ FAILED: Expected error='invalid_coords', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected out-of-range coords with 400 invalid_coords")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def test_route_missing_coords_param():
    """Test 7: Missing coords param → 400"""
    print("\n=== TEST 7: Missing coords param ===")
    try:
        response = requests.get(f"{BASE_URL}/route", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('error') != 'invalid_coords':
            print(f"❌ FAILED: Expected error='invalid_coords', got {data.get('error')}")
            return False
        
        print(f"✅ PASSED: Correctly rejected missing coords param with 400 invalid_coords")
        return True
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False


def main():
    print("=" * 80)
    print("BooMap Backend Test Suite - GET /api/route endpoint")
    print("=" * 80)
    
    results = []
    
    # Sanity check first
    results.append(("Sanity Check: GET /api/listings/public", test_sanity_check_listings_public()))
    
    # Test the new /api/route endpoint
    distance_2_coords = test_route_valid_2_coords()
    results.append(("Test 1: Valid 2 coords", distance_2_coords is not False))
    
    results.append(("Test 2: Valid 3 coords", test_route_valid_3_coords(distance_2_coords)))
    results.append(("Test 3: Only 1 pair → 400", test_route_only_1_pair()))
    results.append(("Test 4: 13 pairs → 400", test_route_too_many_pairs()))
    results.append(("Test 5: Garbage coords → 400", test_route_garbage_coords()))
    results.append(("Test 6: Out-of-range coords → 400", test_route_out_of_range_coords()))
    results.append(("Test 7: Missing coords param → 400", test_route_missing_coords_param()))
    
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
