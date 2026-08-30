#!/usr/bin/env python3
"""
BooMap Backend Test - Stripe Promo Code Verification + Sanity Checks
Tests the new allow_promotion_codes feature and basic API sanity.
"""
import requests
import os
import sys

# Load environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://halloween-map.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')

# Test credentials
DEMO_EMAIL = "demo@boomap.ca"
DEMO_PASSWORD = "BooDemo2025!"

def test_login():
    """Test 1: Login as demo giver"""
    print("\n=== TEST 1: Login as demo giver ===")
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        data = response.json()
        if 'token' not in data:
            print(f"❌ FAILED: No token in response")
            print(f"Response: {data}")
            return None
        
        print(f"✅ PASSED: Login successful, token received")
        return data['token']
    except Exception as e:
        print(f"❌ FAILED: Exception during login: {e}")
        return None

def test_checkout_session(token):
    """Test 2: Create checkout session and verify promo codes enabled"""
    print("\n=== TEST 2: Create Stripe checkout session ===")
    try:
        response = requests.post(
            f"{API_BASE}/payments/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        data = response.json()
        if 'url' not in data or 'session_id' not in data:
            print(f"❌ FAILED: Missing url or session_id in response")
            print(f"Response: {data}")
            return None
        
        if not data['session_id'].startswith('cs_test_'):
            print(f"❌ FAILED: session_id does not start with cs_test_")
            print(f"session_id: {data['session_id']}")
            return None
        
        print(f"✅ PASSED: Checkout session created")
        print(f"  URL: {data['url'][:60]}...")
        print(f"  Session ID: {data['session_id']}")
        return data['session_id']
    except Exception as e:
        print(f"❌ FAILED: Exception during checkout: {e}")
        return None

def test_stripe_session_verification(session_id):
    """Test 3: Retrieve session from Stripe API and verify allow_promotion_codes"""
    print("\n=== TEST 3: Verify Stripe session via API ===")
    try:
        stripe_key = os.getenv('STRIPE_SECRET_KEY', '')
        if not stripe_key:
            print(f"❌ FAILED: STRIPE_SECRET_KEY not found in environment")
            return False
        
        response = requests.get(
            f"https://api.stripe.com/v1/checkout/sessions/{session_id}",
            headers={"Authorization": f"Bearer {stripe_key}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check allow_promotion_codes
        if 'allow_promotion_codes' not in data:
            print(f"❌ FAILED: allow_promotion_codes field not in response")
            print(f"Available fields: {list(data.keys())}")
            return False
        
        if data['allow_promotion_codes'] != True:
            print(f"❌ FAILED: allow_promotion_codes is {data['allow_promotion_codes']}, expected True")
            return False
        
        print(f"✅ PASSED: allow_promotion_codes = True")
        
        # Check mode
        if data.get('mode') != 'payment':
            print(f"❌ FAILED: mode is {data.get('mode')}, expected 'payment'")
            return False
        
        print(f"✅ PASSED: mode = payment")
        
        # Check amount (499 CAD = 499 cents)
        amount_total = data.get('amount_total')
        amount_subtotal = data.get('amount_subtotal')
        
        if amount_subtotal != 499:
            print(f"❌ FAILED: amount_subtotal is {amount_subtotal}, expected 499")
            return False
        
        print(f"✅ PASSED: amount_subtotal = 499 (CAD cents)")
        
        # amount_total might include tax, so just verify it exists and is >= subtotal
        if amount_total is None:
            print(f"❌ FAILED: amount_total is None")
            return False
        
        if amount_total < amount_subtotal:
            print(f"❌ FAILED: amount_total ({amount_total}) < amount_subtotal ({amount_subtotal})")
            return False
        
        print(f"✅ PASSED: amount_total = {amount_total} (includes tax if applicable)")
        
        # Check currency
        if data.get('currency') != 'cad':
            print(f"⚠️  WARNING: currency is {data.get('currency')}, expected 'cad'")
        else:
            print(f"✅ PASSED: currency = cad")
        
        return True
    except Exception as e:
        print(f"❌ FAILED: Exception during Stripe API call: {e}")
        return False

def test_listings_public():
    """Test 4: Sanity check - GET /api/listings/public"""
    print("\n=== TEST 4: Sanity check - GET /listings/public ===")
    try:
        response = requests.get(f"{API_BASE}/listings/public", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Response might be {listings: [...], server_time: ...} or just [...]
        if isinstance(data, dict) and 'listings' in data:
            listings = data['listings']
        elif isinstance(data, list):
            listings = data
        else:
            print(f"❌ FAILED: Unexpected response format")
            print(f"Response: {data}")
            return False
        
        if not isinstance(listings, list):
            print(f"❌ FAILED: listings is not an array")
            return False
        
        print(f"✅ PASSED: GET /listings/public returned {len(listings)} listings")
        return True
    except Exception as e:
        print(f"❌ FAILED: Exception during public listings: {e}")
        return False

def test_listings_mine(token):
    """Test 5: Sanity check - GET /api/listings/mine with demo token"""
    print("\n=== TEST 5: Sanity check - GET /listings/mine ===")
    try:
        response = requests.get(
            f"{API_BASE}/listings/mine",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if 'listing' not in data:
            print(f"❌ FAILED: No listing in response")
            print(f"Response: {data}")
            return False
        
        listing = data['listing']
        
        # Check schedule
        schedule_start = listing.get('schedule_start')
        schedule_end = listing.get('schedule_end')
        manual_override = listing.get('manual_override')
        
        print(f"  schedule_start: {schedule_start}")
        print(f"  schedule_end: {schedule_end}")
        print(f"  manual_override: {manual_override}")
        
        if schedule_start != '17:00':
            print(f"⚠️  WARNING: schedule_start is {schedule_start}, expected 17:00")
        else:
            print(f"✅ schedule_start = 17:00")
        
        if schedule_end != '20:30':
            print(f"⚠️  WARNING: schedule_end is {schedule_end}, expected 20:30")
        else:
            print(f"✅ schedule_end = 20:30")
        
        if manual_override is not None:
            print(f"⚠️  WARNING: manual_override is {manual_override}, expected null")
        else:
            print(f"✅ manual_override = null")
        
        print(f"✅ PASSED: GET /listings/mine successful")
        return True
    except Exception as e:
        print(f"❌ FAILED: Exception during my listings: {e}")
        return False

def main():
    print("=" * 70)
    print("BooMap Backend Test - Stripe Promo Code Verification")
    print("=" * 70)
    
    # Load STRIPE_SECRET_KEY from .env if not in environment
    if not STRIPE_SECRET_KEY:
        try:
            with open('/app/.env', 'r') as f:
                for line in f:
                    if line.startswith('STRIPE_SECRET_KEY='):
                        os.environ['STRIPE_SECRET_KEY'] = line.split('=', 1)[1].strip()
                        print(f"Loaded STRIPE_SECRET_KEY from .env")
                        break
        except Exception as e:
            print(f"Warning: Could not load .env: {e}")
    
    results = []
    
    # Test 1: Login
    token = test_login()
    results.append(("Login as demo giver", token is not None))
    if not token:
        print("\n❌ Cannot continue without token")
        sys.exit(1)
    
    # Test 2: Create checkout session
    session_id = test_checkout_session(token)
    results.append(("Create checkout session", session_id is not None))
    if not session_id:
        print("\n❌ Cannot continue without session_id")
        sys.exit(1)
    
    # Test 3: Verify Stripe session
    stripe_ok = test_stripe_session_verification(session_id)
    results.append(("Verify Stripe session (promo codes + amount)", stripe_ok))
    
    # Test 4: Sanity - public listings
    public_ok = test_listings_public()
    results.append(("Sanity: GET /listings/public", public_ok))
    
    # Test 5: Sanity - my listings
    mine_ok = test_listings_mine(token)
    results.append(("Sanity: GET /listings/mine", mine_ok))
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    
    for test_name, ok in results:
        status = "✅ PASSED" if ok else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
