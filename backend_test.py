#!/usr/bin/env python3
"""
BooMap Backend API Test Suite
Tests all backend endpoints according to the review request
"""
import requests
import json
import time
import random
import string

# Base URL from .env
BASE_URL = "https://halloween-map.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@boomap.ca"
ADMIN_PASSWORD = "BooAdmin2025!"
DEMO_EMAIL = "demo@boomap.ca"
DEMO_PASSWORD = "BooDemo2025!"

# Global variables to store tokens and IDs
admin_token = None
demo_token = None
new_user_token = None
new_user_email = None
new_listing_id = None
report_id = None
test_session_id = None

def generate_random_email():
    """Generate a random email for testing"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{random_str}@boomap-test.ca"

def print_test(name):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def test_seed():
    """Test POST /api/seed - idempotent seed data"""
    print_test("SEED: POST /api/seed")
    try:
        response = requests.post(f"{BASE_URL}/seed", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Seed successful: {data}")
            return True
        else:
            print_result(False, f"Seed failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Seed error: {str(e)}")
        return False

def test_auth_register_new():
    """Test POST /api/auth/register with new random email"""
    global new_user_token, new_user_email
    print_test("AUTH: POST /api/auth/register (new user)")
    
    new_user_email = generate_random_email()
    payload = {
        "name": "Test User",
        "email": new_user_email,
        "password": "TestPass123!",
        "language": "en"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'token' in data and 'user' in data:
                new_user_token = data['token']
                print_result(True, f"Registration successful for {new_user_email}, token received")
                return True
            else:
                print_result(False, f"Registration response missing token or user: {data}")
                return False
        else:
            print_result(False, f"Registration failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Registration error: {str(e)}")
        return False

def test_auth_register_duplicate():
    """Test POST /api/auth/register with duplicate email - expect 409"""
    print_test("AUTH: POST /api/auth/register (duplicate email)")
    
    payload = {
        "name": "Duplicate User",
        "email": new_user_email,
        "password": "AnotherPass123!",
        "language": "en"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        if response.status_code == 409:
            print_result(True, f"Duplicate email correctly rejected with 409: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 409, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Duplicate registration error: {str(e)}")
        return False

def test_auth_login_demo():
    """Test POST /api/auth/login with demo credentials"""
    global demo_token
    print_test("AUTH: POST /api/auth/login (demo user)")
    
    payload = {
        "email": DEMO_EMAIL,
        "password": DEMO_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'token' in data:
                demo_token = data['token']
                print_result(True, f"Login successful for {DEMO_EMAIL}, token received")
                return True
            else:
                print_result(False, f"Login response missing token: {data}")
                return False
        else:
            print_result(False, f"Login failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Login error: {str(e)}")
        return False

def test_auth_login_bad_password():
    """Test POST /api/auth/login with bad password - expect 401"""
    print_test("AUTH: POST /api/auth/login (bad password)")
    
    payload = {
        "email": DEMO_EMAIL,
        "password": "WrongPassword123!"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        if response.status_code == 401:
            print_result(True, f"Bad password correctly rejected with 401: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Bad password test error: {str(e)}")
        return False

def test_auth_me_with_token():
    """Test GET /api/auth/me with Bearer token"""
    print_test("AUTH: GET /api/auth/me (with token)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'user' in data:
                print_result(True, f"Auth/me successful: {data['user']}")
                return True
            else:
                print_result(False, f"Auth/me response missing user: {data}")
                return False
        else:
            print_result(False, f"Auth/me failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Auth/me error: {str(e)}")
        return False

def test_auth_me_no_token():
    """Test GET /api/auth/me without token - expect 401"""
    print_test("AUTH: GET /api/auth/me (no token)")
    
    try:
        response = requests.get(f"{BASE_URL}/auth/me", timeout=10)
        if response.status_code == 401:
            print_result(True, f"No token correctly rejected with 401: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"No token test error: {str(e)}")
        return False

def test_listings_create():
    """Test POST /api/listings with new user token"""
    global new_listing_id
    print_test("LISTINGS: POST /api/listings (create)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    payload = {
        "host_name": "Test Family",
        "address": "123 Rue Test, Montréal, QC",
        "lat": 45.51,
        "lng": -73.57,
        "hide_number": True,
        "schedule_start": "17:00",
        "schedule_end": "20:00",
        "candy_note": "Test candy note",
        "tz_offset": 240
    }
    
    try:
        response = requests.post(f"{BASE_URL}/listings", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'listing' in data:
                listing = data['listing']
                new_listing_id = listing.get('id')
                has_trial = 'trial_ends_at' in listing
                is_unpaid = listing.get('paid') == False
                has_status = 'status' in listing
                print_result(True, f"Listing created: id={new_listing_id}, trial_ends_at={listing.get('trial_ends_at')}, paid={listing.get('paid')}, status={listing.get('status')}")
                return has_trial and is_unpaid and has_status
            else:
                print_result(False, f"Listing response missing listing: {data}")
                return False
        else:
            print_result(False, f"Listing creation failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Listing creation error: {str(e)}")
        return False

def test_listings_mine():
    """Test GET /api/listings/mine"""
    print_test("LISTINGS: GET /api/listings/mine")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/listings/mine", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'listing' in data and data['listing']:
                listing = data['listing']
                matches_id = listing.get('id') == new_listing_id
                print_result(True, f"Listing retrieved: id={listing.get('id')}, matches={matches_id}")
                return matches_id
            else:
                print_result(False, f"Listing/mine response missing listing: {data}")
                return False
        else:
            print_result(False, f"Listing/mine failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Listing/mine error: {str(e)}")
        return False

def test_listings_upsert():
    """Test POST /api/listings again (upsert with changed candy_note)"""
    print_test("LISTINGS: POST /api/listings (upsert)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    payload = {
        "host_name": "Test Family",
        "address": "123 Rue Test, Montréal, QC",
        "lat": 45.51,
        "lng": -73.57,
        "hide_number": True,
        "schedule_start": "17:00",
        "schedule_end": "20:00",
        "candy_note": "Updated candy note",
        "tz_offset": 240
    }
    
    try:
        response = requests.post(f"{BASE_URL}/listings", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'listing' in data:
                listing = data['listing']
                same_id = listing.get('id') == new_listing_id
                updated_note = listing.get('candy_note') == "Updated candy note"
                print_result(True, f"Listing upserted: same_id={same_id}, candy_note={listing.get('candy_note')}")
                return same_id and updated_note
            else:
                print_result(False, f"Listing upsert response missing listing: {data}")
                return False
        else:
            print_result(False, f"Listing upsert failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Listing upsert error: {str(e)}")
        return False

def test_listings_invalid_lat():
    """Test POST /api/listings with invalid lat - expect 400"""
    print_test("LISTINGS: POST /api/listings (invalid lat)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    payload = {
        "host_name": "Test Family",
        "address": "123 Rue Test, Montréal, QC",
        "lat": 999,  # Invalid
        "lng": -73.57,
        "hide_number": True,
        "schedule_start": "17:00",
        "schedule_end": "20:00",
        "candy_note": "Test",
        "tz_offset": 240
    }
    
    try:
        response = requests.post(f"{BASE_URL}/listings", json=payload, headers=headers, timeout=10)
        if response.status_code == 400:
            print_result(True, f"Invalid lat correctly rejected with 400: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Invalid lat test error: {str(e)}")
        return False

def test_listings_override_active():
    """Test PATCH /api/listings/override with override='active'"""
    print_test("STATUS: PATCH /api/listings/override (active)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    payload = {"override": "active"}
    
    try:
        response = requests.patch(f"{BASE_URL}/listings/override", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'listing' in data:
                listing = data['listing']
                is_green = listing.get('status') == 'green'
                print_result(True, f"Override active: status={listing.get('status')}, is_green={is_green}")
                return is_green
            else:
                print_result(False, f"Override response missing listing: {data}")
                return False
        else:
            print_result(False, f"Override active failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Override active error: {str(e)}")
        return False

def test_listings_override_done():
    """Test PATCH /api/listings/override with override='done'"""
    print_test("STATUS: PATCH /api/listings/override (done)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    payload = {"override": "done"}
    
    try:
        response = requests.patch(f"{BASE_URL}/listings/override", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'listing' in data:
                listing = data['listing']
                is_red = listing.get('status') == 'red'
                print_result(True, f"Override done: status={listing.get('status')}, is_red={is_red}")
                return is_red
            else:
                print_result(False, f"Override response missing listing: {data}")
                return False
        else:
            print_result(False, f"Override done failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Override done error: {str(e)}")
        return False

def test_listings_override_null():
    """Test PATCH /api/listings/override with override=null (schedule-based)"""
    print_test("STATUS: PATCH /api/listings/override (null)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    payload = {"override": None}
    
    try:
        response = requests.patch(f"{BASE_URL}/listings/override", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'listing' in data:
                listing = data['listing']
                status = listing.get('status')
                is_valid = status in ['white', 'green', 'red']
                print_result(True, f"Override null: status={status}, schedule-based={is_valid}")
                return is_valid
            else:
                print_result(False, f"Override response missing listing: {data}")
                return False
        else:
            print_result(False, f"Override null failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Override null error: {str(e)}")
        return False

def test_listings_public():
    """Test GET /api/listings/public (no auth)"""
    print_test("PUBLIC MAP: GET /api/listings/public")
    
    try:
        response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'listings' in data:
                listings = data['listings']
                print(f"Found {len(listings)} public listings")
                
                # Check for our new listing
                our_listing = None
                for l in listings:
                    if l.get('id') == new_listing_id:
                        our_listing = l
                        break
                
                if not our_listing:
                    print_result(False, "Our new listing not found in public listings")
                    return False
                
                # Verify address_display has NO leading street number
                address_display = our_listing.get('address_display', '')
                has_leading_number = address_display and address_display[0].isdigit()
                
                # Verify no sensitive data leaked
                has_user_id = 'user_id' in our_listing
                has_email = 'email' in our_listing
                has_trial = 'trial_ends_at' in our_listing
                has_paid = 'paid' in our_listing
                
                # Verify status is white/green/red
                status = our_listing.get('status')
                valid_status = status in ['white', 'green', 'red']
                
                no_leaks = not (has_user_id or has_email or has_trial or has_paid)
                
                print(f"Address display: '{address_display}', has_leading_number={has_leading_number}")
                print(f"Sensitive data check: user_id={has_user_id}, email={has_email}, trial={has_trial}, paid={has_paid}")
                print(f"Status: {status}, valid={valid_status}")
                
                success = not has_leading_number and no_leaks and valid_status
                print_result(success, f"Public listing verified: no_leading_number={not has_leading_number}, no_leaks={no_leaks}, valid_status={valid_status}")
                return success
            else:
                print_result(False, f"Public listings response missing listings: {data}")
                return False
        else:
            print_result(False, f"Public listings failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Public listings error: {str(e)}")
        return False

def test_geocode():
    """Test GET /api/geocode?q=montreal - expect 503 mapbox_token_missing"""
    print_test("GEOCODE: GET /api/geocode?q=montreal")
    
    try:
        response = requests.get(f"{BASE_URL}/geocode?q=montreal", timeout=10)
        if response.status_code == 503:
            data = response.json()
            if data.get('error') == 'mapbox_token_missing':
                print_result(True, f"Geocode correctly returns 503 with mapbox_token_missing (expected behavior)")
                return True
            else:
                print_result(False, f"Expected error='mapbox_token_missing', got: {data}")
                return False
        else:
            print_result(False, f"Expected 503, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Geocode error: {str(e)}")
        return False

def test_stripe_checkout():
    """Test POST /api/payments/checkout with giver token"""
    global test_session_id
    print_test("STRIPE: POST /api/payments/checkout")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    
    try:
        response = requests.post(f"{BASE_URL}/payments/checkout", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            url = data.get('url', '')
            session_id = data.get('session_id', '')
            
            url_valid = url.startswith('https://checkout.stripe.com')
            session_valid = session_id.startswith('cs_test_')
            
            if url_valid and session_valid:
                test_session_id = session_id
                print_result(True, f"Checkout session created: url={url[:50]}..., session_id={session_id}")
                return True
            else:
                print_result(False, f"Invalid checkout response: url_valid={url_valid}, session_valid={session_valid}")
                return False
        else:
            print_result(False, f"Checkout failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Checkout error: {str(e)}")
        return False

def test_stripe_status():
    """Test GET /api/payments/status?session_id=<id>"""
    print_test("STRIPE: GET /api/payments/status")
    
    try:
        response = requests.get(f"{BASE_URL}/payments/status?session_id={test_session_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            status = data.get('status')
            valid_status = status in ['pending', 'expired', 'paid']
            print_result(True, f"Payment status: {status}, valid={valid_status}")
            return valid_status
        else:
            print_result(False, f"Payment status failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Payment status error: {str(e)}")
        return False

def test_stripe_status_invalid():
    """Test GET /api/payments/status with invalid session_id - expect 400"""
    print_test("STRIPE: GET /api/payments/status (invalid session_id)")
    
    try:
        response = requests.get(f"{BASE_URL}/payments/status?session_id=invalid_id", timeout=10)
        if response.status_code == 400:
            print_result(True, f"Invalid session_id correctly rejected with 400: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Invalid session_id test error: {str(e)}")
        return False

def test_stripe_checkout_no_auth():
    """Test POST /api/payments/checkout without auth - expect 401"""
    print_test("STRIPE: POST /api/payments/checkout (no auth)")
    
    try:
        response = requests.post(f"{BASE_URL}/payments/checkout", timeout=10)
        if response.status_code == 401:
            print_result(True, f"No auth correctly rejected with 401: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"No auth checkout test error: {str(e)}")
        return False

def test_reports_create():
    """Test POST /api/reports with listing_id"""
    global report_id
    print_test("REPORTS: POST /api/reports")
    
    # Get a public listing ID to report
    response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
    listings = response.json().get('listings', [])
    if not listings:
        print_result(False, "No public listings available to report")
        return False
    
    listing_id = listings[0]['id']
    payload = {
        "listing_id": listing_id,
        "reason": "safety",
        "comment": "test report"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/reports", json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_result(True, f"Report created for listing {listing_id}")
                return True
            else:
                print_result(False, f"Report response not ok: {data}")
                return False
        else:
            print_result(False, f"Report creation failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Report creation error: {str(e)}")
        return False

def test_reports_nonexistent():
    """Test POST /api/reports with nonexistent listing_id - expect 404"""
    print_test("REPORTS: POST /api/reports (nonexistent listing)")
    
    payload = {
        "listing_id": "00000000-0000-0000-0000-000000000000",
        "reason": "safety",
        "comment": "test"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/reports", json=payload, timeout=10)
        if response.status_code == 404:
            print_result(True, f"Nonexistent listing correctly rejected with 404: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 404, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Nonexistent listing test error: {str(e)}")
        return False

def test_admin_login():
    """Test admin login"""
    global admin_token
    print_test("ADMIN: Login as admin")
    
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'token' in data:
                admin_token = data['token']
                print_result(True, f"Admin login successful")
                return True
            else:
                print_result(False, f"Admin login response missing token: {data}")
                return False
        else:
            print_result(False, f"Admin login failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Admin login error: {str(e)}")
        return False

def test_admin_overview():
    """Test GET /api/admin/overview with admin token"""
    global report_id
    print_test("ADMIN: GET /api/admin/overview (admin token)")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/admin/overview", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            has_listings = 'listings' in data
            has_reports = 'reports' in data
            
            if has_listings and has_reports:
                listings = data['listings']
                reports = data['reports']
                print(f"Admin overview: {len(listings)} listings, {len(reports)} reports")
                
                # Find our report
                if reports:
                    report_id = reports[0]['id']
                
                # Check if reported_count is present
                reported_listing = None
                for l in listings:
                    if l.get('reported_count', 0) > 0:
                        reported_listing = l
                        break
                
                print_result(True, f"Admin overview successful, found reported listing: {reported_listing is not None}")
                return True
            else:
                print_result(False, f"Admin overview missing listings or reports: {data}")
                return False
        else:
            print_result(False, f"Admin overview failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Admin overview error: {str(e)}")
        return False

def test_admin_overview_forbidden():
    """Test GET /api/admin/overview with giver token - expect 403"""
    print_test("ADMIN: GET /api/admin/overview (giver token)")
    
    headers = {"Authorization": f"Bearer {new_user_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/admin/overview", headers=headers, timeout=10)
        if response.status_code == 403:
            print_result(True, f"Giver token correctly rejected with 403: {response.json()}")
            return True
        else:
            print_result(False, f"Expected 403, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Admin overview forbidden test error: {str(e)}")
        return False

def test_admin_listings_hide():
    """Test PATCH /api/admin/listings with action='hide'"""
    print_test("ADMIN: PATCH /api/admin/listings (hide)")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "listing_id": new_listing_id,
        "action": "hide"
    }
    
    try:
        response = requests.patch(f"{BASE_URL}/admin/listings", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                # Verify listing is hidden in public
                pub_response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
                pub_listings = pub_response.json().get('listings', [])
                is_hidden = not any(l.get('id') == new_listing_id for l in pub_listings)
                print_result(True, f"Listing hidden, not in public: {is_hidden}")
                return is_hidden
            else:
                print_result(False, f"Hide response not ok: {data}")
                return False
        else:
            print_result(False, f"Hide listing failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Hide listing error: {str(e)}")
        return False

def test_admin_listings_unhide():
    """Test PATCH /api/admin/listings with action='unhide'"""
    print_test("ADMIN: PATCH /api/admin/listings (unhide)")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "listing_id": new_listing_id,
        "action": "unhide"
    }
    
    try:
        response = requests.patch(f"{BASE_URL}/admin/listings", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                # Verify listing is visible in public again
                pub_response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
                pub_listings = pub_response.json().get('listings', [])
                is_visible = any(l.get('id') == new_listing_id for l in pub_listings)
                print_result(True, f"Listing unhidden, in public: {is_visible}")
                return is_visible
            else:
                print_result(False, f"Unhide response not ok: {data}")
                return False
        else:
            print_result(False, f"Unhide listing failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Unhide listing error: {str(e)}")
        return False

def test_admin_listings_reject_photo():
    """Test PATCH /api/admin/listings with action='reject_photo'"""
    print_test("ADMIN: PATCH /api/admin/listings (reject_photo)")
    
    # First, add a photo to our listing
    headers = {"Authorization": f"Bearer {new_user_token}"}
    payload = {
        "host_name": "Test Family",
        "address": "123 Rue Test, Montréal, QC",
        "lat": 45.51,
        "lng": -73.57,
        "hide_number": True,
        "schedule_start": "17:00",
        "schedule_end": "20:00",
        "candy_note": "Updated candy note",
        "tz_offset": 240,
        "photo_url": "https://example.com/test.jpg"
    }
    requests.post(f"{BASE_URL}/listings", json=payload, headers=headers, timeout=10)
    
    # Now reject the photo as admin
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_payload = {
        "listing_id": new_listing_id,
        "action": "reject_photo"
    }
    
    try:
        response = requests.patch(f"{BASE_URL}/admin/listings", json=admin_payload, headers=admin_headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                # Verify photo_url is null in public listing
                pub_response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
                pub_listings = pub_response.json().get('listings', [])
                our_listing = next((l for l in pub_listings if l.get('id') == new_listing_id), None)
                photo_is_null = our_listing and our_listing.get('photo_url') is None
                print_result(True, f"Photo rejected, photo_url is null: {photo_is_null}")
                return photo_is_null
            else:
                print_result(False, f"Reject photo response not ok: {data}")
                return False
        else:
            print_result(False, f"Reject photo failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Reject photo error: {str(e)}")
        return False

def test_admin_listings_approve_photo():
    """Test PATCH /api/admin/listings with action='approve_photo'"""
    print_test("ADMIN: PATCH /api/admin/listings (approve_photo)")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "listing_id": new_listing_id,
        "action": "approve_photo"
    }
    
    try:
        response = requests.patch(f"{BASE_URL}/admin/listings", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                # Verify photo_url is restored in public listing
                pub_response = requests.get(f"{BASE_URL}/listings/public", timeout=10)
                pub_listings = pub_response.json().get('listings', [])
                our_listing = next((l for l in pub_listings if l.get('id') == new_listing_id), None)
                photo_restored = our_listing and our_listing.get('photo_url') is not None
                print_result(True, f"Photo approved, photo_url restored: {photo_restored}")
                return photo_restored
            else:
                print_result(False, f"Approve photo response not ok: {data}")
                return False
        else:
            print_result(False, f"Approve photo failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Approve photo error: {str(e)}")
        return False

def test_admin_reports_resolve():
    """Test PATCH /api/admin/reports with status='resolved'"""
    print_test("ADMIN: PATCH /api/admin/reports (resolved)")
    
    if not report_id:
        print_result(False, "No report_id available to resolve")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "report_id": report_id,
        "status": "resolved"
    }
    
    try:
        response = requests.patch(f"{BASE_URL}/admin/reports", json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                # Verify report is no longer in open list
                overview_response = requests.get(f"{BASE_URL}/admin/overview", headers=headers, timeout=10)
                reports = overview_response.json().get('reports', [])
                is_removed = not any(r.get('id') == report_id for r in reports)
                print_result(True, f"Report resolved, removed from open list: {is_removed}")
                return is_removed
            else:
                print_result(False, f"Resolve report response not ok: {data}")
                return False
        else:
            print_result(False, f"Resolve report failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Resolve report error: {str(e)}")
        return False

def run_all_tests():
    """Run all tests in order"""
    print("\n" + "="*80)
    print("BOOMAP BACKEND API TEST SUITE")
    print("="*80)
    
    results = {}
    
    # SETUP
    results['seed'] = test_seed()
    time.sleep(0.5)
    
    # AUTH TESTS
    results['auth_register_new'] = test_auth_register_new()
    time.sleep(0.5)
    results['auth_register_duplicate'] = test_auth_register_duplicate()
    time.sleep(0.5)
    results['auth_login_demo'] = test_auth_login_demo()
    time.sleep(0.5)
    results['auth_login_bad_password'] = test_auth_login_bad_password()
    time.sleep(0.5)
    results['auth_me_with_token'] = test_auth_me_with_token()
    time.sleep(0.5)
    results['auth_me_no_token'] = test_auth_me_no_token()
    time.sleep(0.5)
    
    # LISTINGS TESTS
    results['listings_create'] = test_listings_create()
    time.sleep(0.5)
    results['listings_mine'] = test_listings_mine()
    time.sleep(0.5)
    results['listings_upsert'] = test_listings_upsert()
    time.sleep(0.5)
    results['listings_invalid_lat'] = test_listings_invalid_lat()
    time.sleep(0.5)
    
    # STATUS TESTS
    results['listings_override_active'] = test_listings_override_active()
    time.sleep(0.5)
    results['listings_override_done'] = test_listings_override_done()
    time.sleep(0.5)
    results['listings_override_null'] = test_listings_override_null()
    time.sleep(0.5)
    
    # PUBLIC MAP TESTS
    results['listings_public'] = test_listings_public()
    time.sleep(0.5)
    
    # GEOCODE TESTS
    results['geocode'] = test_geocode()
    time.sleep(0.5)
    
    # STRIPE TESTS
    results['stripe_checkout'] = test_stripe_checkout()
    time.sleep(0.5)
    results['stripe_status'] = test_stripe_status()
    time.sleep(0.5)
    results['stripe_status_invalid'] = test_stripe_status_invalid()
    time.sleep(0.5)
    results['stripe_checkout_no_auth'] = test_stripe_checkout_no_auth()
    time.sleep(0.5)
    
    # REPORTS TESTS
    results['reports_create'] = test_reports_create()
    time.sleep(0.5)
    results['reports_nonexistent'] = test_reports_nonexistent()
    time.sleep(0.5)
    
    # ADMIN TESTS
    results['admin_login'] = test_admin_login()
    time.sleep(0.5)
    results['admin_overview'] = test_admin_overview()
    time.sleep(0.5)
    results['admin_overview_forbidden'] = test_admin_overview_forbidden()
    time.sleep(0.5)
    results['admin_listings_hide'] = test_admin_listings_hide()
    time.sleep(0.5)
    results['admin_listings_unhide'] = test_admin_listings_unhide()
    time.sleep(0.5)
    results['admin_listings_reject_photo'] = test_admin_listings_reject_photo()
    time.sleep(0.5)
    results['admin_listings_approve_photo'] = test_admin_listings_approve_photo()
    time.sleep(0.5)
    results['admin_reports_resolve'] = test_admin_reports_resolve()
    
    # SUMMARY
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("\nDetailed Results:")
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {test_name}")
    
    print("\n" + "="*80)
    
    return results

if __name__ == "__main__":
    run_all_tests()
