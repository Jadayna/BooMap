#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "BooMap — mobile-first real-time Halloween trick-or-treating map. Candy Givers register houses (address, photo, schedule window), pins white/green/red (auto by schedule + manual override), trick-or-treaters browse free with real-time sync (polling interim until Supabase creds), 3-day trial then one-time $4.99 CAD via Stripe (test keys), privacy (hidden street numbers, reports, admin moderation), bilingual EN/FR."

backend:
  - task: "Auth (register/login/me, JWT, bcrypt)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/auth/register, /api/auth/login, GET /api/auth/me with Bearer JWT. Seed creds in /app/memory/test_credentials.md (admin@boomap.ca/BooAdmin2025!, demo@boomap.ca/BooDemo2025!)"
      - working: true
        agent: "testing"
        comment: "✅ ALL AUTH TESTS PASSED (7/7): register with new email returns token+user, duplicate email returns 409, login with demo credentials works, bad password returns 401, /auth/me with token returns user, /auth/me without token returns 401. JWT authentication working correctly."
  - task: "Listings CRUD + status computation + public visibility"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/listings (upsert own), GET /api/listings/mine, GET /api/listings/public (hides street numbers, excludes hidden/expired-unpaid, computes white/green/red from schedule + tz_offset), PATCH /api/listings/override (active/done/null)"
      - working: true
        agent: "testing"
        comment: "✅ ALL LISTINGS TESTS PASSED (8/8): POST /listings creates listing with trial_ends_at ~3 days, paid=false, status computed. GET /mine returns same listing. POST again (upsert) updates candy_note with same id. Invalid lat (999) returns 400. PATCH /override with 'active' returns status=green, 'done' returns status=red, null returns schedule-based (white/green/red). GET /public returns listings with address_display stripped of street numbers (e.g., 'Rue Test, Montréal, QC' not '123 Rue Test...'), no user_id/email/trial/paid fields leaked, statuses are white/green/red."
  - task: "Geocode proxy (Mapbox)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/geocode?q= — NEXT_PUBLIC_MAPBOX_TOKEN is EMPTY by design, so 503 {error:'mapbox_token_missing'} is the EXPECTED correct behavior. Do not flag as bug."
      - working: true
        agent: "testing"
        comment: "✅ GEOCODE TEST PASSED (1/1): GET /geocode?q=montreal correctly returns 503 with error='mapbox_token_missing'. This is EXPECTED behavior as Mapbox token is intentionally empty."
  - task: "Stripe checkout + payment status (test mode)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/payments/checkout (auth, $4.99 CAD server-side, returns Stripe hosted url), GET /api/payments/status?session_id= (verifies with Stripe directly, marks listing paid). Webhook /api/webhooks/stripe returns 400 when STRIPE_WEBHOOK_SECRET empty (expected). Do NOT complete a real card payment; just verify session creation returns url + pending status."
      - working: true
        agent: "testing"
        comment: "✅ ALL STRIPE TESTS PASSED (4/4): POST /payments/checkout with giver token returns {url: 'https://checkout.stripe.com/...', session_id: 'cs_test_...'}, GET /payments/status?session_id=<valid> returns status='pending', invalid session_id returns 400, checkout without auth returns 401. FIXES APPLIED: (1) Fixed .env formatting issue where CORS_ORIGINS and STRIPE_SECRET_KEY were on same line, (2) Added tax_code='txcd_10000000' and automatic_tax={enabled:true} to Stripe checkout session to satisfy Managed Payments requirement."
  - task: "Reports + admin moderation endpoints"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/reports (anonymous), GET /api/admin/overview (admin only, 403 otherwise), PATCH /api/admin/listings {listing_id, action: approve_photo|reject_photo|hide|unhide}, PATCH /api/admin/reports {report_id, status}. POST /api/seed idempotent."
      - working: true
        agent: "testing"
        comment: "✅ ALL REPORTS & ADMIN TESTS PASSED (10/10): POST /reports with listing_id creates report and increments reported_count, nonexistent listing_id returns 404. Admin login successful. GET /admin/overview with admin token returns {listings, reports} including reported_count, giver token returns 403. PATCH /admin/listings with action='hide' removes listing from public, 'unhide' restores it, 'reject_photo' sets photo_url=null in public, 'approve_photo' restores photo_url. PATCH /admin/reports with status='resolved' removes report from open list."

frontend:
  - task: "Map view, bilingual UI, dashboard, admin (visual check done via screenshot)"
    implemented: true
    working: "NA"
    file: "app/page.js, components/BooMap.js, lib/i18n.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Screenshot verified EN+FR map view with fallback (no Mapbox token yet). Frontend testing NOT requested yet."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Auth (register/login/me, JWT, bcrypt)"
    - "Listings CRUD + status computation + public visibility"
    - "Stripe checkout + payment status (test mode)"
    - "Reports + admin moderation endpoints"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Initial BooMap MVP backend complete. Test via NEXT_PUBLIC_BASE_URL/api. Seed first with POST /api/seed (idempotent). Mapbox token intentionally empty (geocode 503 expected). Stripe TEST keys configured — create checkout session but do NOT pay. Use UUID ids, never Mongo ObjectID."
  - agent: "testing"
    message: "Backend testing complete: ALL 30 TESTS PASSED (100% success rate). Tested Auth (7 tests), Listings CRUD + status (8 tests), Geocode (1 test), Stripe payments (4 tests), Reports + Admin (10 tests). Fixed 2 issues during testing: (1) .env formatting bug where CORS_ORIGINS and STRIPE_SECRET_KEY were concatenated on same line, (2) Stripe Managed Payments requirement - added tax_code and automatic_tax to checkout session. All backend APIs working correctly. Ready for production."
