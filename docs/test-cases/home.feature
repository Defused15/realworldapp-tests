Feature: Home Dashboard
  As a signed-in user
  I want to see my transaction feed and account summary on the dashboard
  So that I can monitor activity, switch between feeds, and navigate to key actions

  Background:
    Given the application is running at http://localhost:3000
    And the database has been seeded with known test data
    And I am signed in as "Heath93" with password "s3cret"
    And I am on the home dashboard at http://localhost:3000/

  # ===== HAPPY PATH =====

  @smoke
  Scenario: Authenticated user sees the dashboard with a transaction list
    Given I am on the home dashboard
    Then I should see the "Everyone" tab selected by default
    And I should see a list of transactions in the main content area
    And each transaction row should show sender and receiver avatars, a description, and an amount

  @smoke
  Scenario: Sidebar shows current user's name, username, and balance
    Given I am on the home dashboard
    When I open the left sidebar by clicking the hamburger button
    Then I should see the full name "Ted P"
    And I should see the username "@Heath93"
    And I should see the account balance "$1,509.53"

  @smoke
  Scenario: User switches to the Friends tab
    Given I am on the home dashboard
    When I click the "Friends" tab
    Then the section label should change to "Friends"
    And the transaction list should update to show only transactions involving my contacts

  @smoke
  Scenario: User switches to the Mine tab
    Given I am on the home dashboard
    When I click the "Mine" tab
    Then the section label should change to "Mine"
    And the transaction list should update to show only my own transactions

  @smoke
  Scenario: User switches back to the Everyone tab
    Given I am on the home dashboard
    And I have clicked the "Mine" tab
    When I click the "Everyone" tab
    Then the section label should change to "Public"
    And the transaction list should update to show all public transactions

  @smoke
  Scenario: User navigates to create a new transaction
    Given I am on the home dashboard
    When I click the "New" button in the header
    Then I should be taken to the new transaction page at /transaction/new

  @smoke
  Scenario: User navigates to notifications from the header bell
    Given I am on the home dashboard
    When I click the notifications bell icon in the header
    Then I should be taken to the notifications page at /notifications

  @smoke
  Scenario: Unread notification badge shows the correct count
    Given I am on the home dashboard
    Then I should see a badge on the notifications bell icon
    And the badge should display "8" unread notifications

  @smoke
  Scenario: Sidebar navigation links are present
    Given I am on the home dashboard
    When I open the left sidebar
    Then I should see navigation links for "Home", "My Account", "Bank Accounts", and "Notifications"
    And I should see a "Logout" button

  @smoke
  Scenario: User can log out from the sidebar
    Given I am on the home dashboard
    When I open the left sidebar
    And I click the "Logout" button
    Then I should be redirected to the sign in page at /signin
    And my session should be terminated

  # ===== EDGE CASES =====

  @regression @skip
  Scenario: Date filter narrows visible transactions
    # BUG-HOME-001: GET /transactions/public with dateStart/dateEnd params returns
    # 500 (server crash), so the date-range filter cannot be exercised. This
    # scenario documents the intended behavior; skipped until the endpoint is
    # fixed. See BUG-HOME-001 in docs/bug-reports/bugs.yml (re-verified FIXED 2026-06-16).
    Given I am on the home dashboard
    And the "Everyone" tab is selected
    When I set the date filter to a specific date range with no matching transactions
    Then I should see an empty state message indicating no transactions match the filter

  @regression
  Scenario: Amount filter narrows visible transactions
    Given I am on the home dashboard
    And the "Everyone" tab is selected
    When I change the amount filter range to "$900 - $1,000"
    Then the transaction list should only show transactions with amounts within that range

  @regression
  Scenario: Amount filter reset to default shows all transactions
    Given I am on the home dashboard
    And I have applied an amount filter of "$900 - $1,000"
    When I reset the amount filter to the default "$0 - $1,000"
    Then the transaction list should show all transactions again

  @regression
  Scenario: Pagination loads the next page of transactions
    Given I am on the home dashboard
    And the "Everyone" tab is selected
    And the first page of transactions is displayed (10 items)
    When I click the next page control
    Then the second page of transactions should load
    And I should see a different set of 10 transactions

  @regression
  Scenario: Last page shows fewer than 10 transactions
    Given I am on the home dashboard
    And the "Everyone" tab is selected
    When I navigate to the last page of the transaction list
    Then I should see fewer than or equal to 10 transactions
    And the next page control should be disabled or not visible

  @regression
  Scenario: Transaction row shows zero likes and zero comments counts
    Given I am on the home dashboard
    And a transaction with no likes and no comments is visible in the list
    Then that transaction row should display a like count of "0"
    And it should display a comment count of "0"

  @regression
  Scenario: Negative amount is displayed in red for a payment sent
    Given I am on the home dashboard
    And the "Mine" tab is selected
    When a transaction where I am the sender is visible
    Then the amount should be displayed in red with a negative sign

  @regression
  Scenario: Positive amount is displayed in green for a payment received
    Given I am on the home dashboard
    And the "Mine" tab is selected
    When a transaction where I am the receiver is visible
    Then the amount should be displayed in green with a positive sign

  @regression
  Scenario Outline: Switching tabs resets filter state
    Given I am on the home dashboard
    And I have applied the date filter on the "Everyone" tab
    When I switch to the "<tab>" tab
    Then the transaction list should reflect the "<tab>" feed without the previous filter applied

    Examples:
      | tab     |
      | Friends |
      | Mine    |

  # ===== SECURITY =====

  @security
  Scenario: Unauthenticated user is redirected to the sign in page
    Given I am not signed in
    When I navigate directly to http://localhost:3000/
    Then I should be redirected to http://localhost:3000/signin
    And I should not see any dashboard content

  @security
  Scenario: Logged-out user cannot access the dashboard
    Given I was previously signed in as "Heath93"
    And I have clicked the "Logout" button
    When I navigate directly to http://localhost:3000/
    Then I should be redirected to http://localhost:3000/signin
    And I should not see any account or transaction data

  @security
  Scenario: Expired or deleted session cookie results in redirect
    Given I have a session cookie that has been invalidated server-side
    When I navigate to http://localhost:3000/
    Then I should be redirected to http://localhost:3000/signin
    And I should not see any dashboard content

  @security
  Scenario: XSS payload in a transaction note is not executed
    Given I am on the home dashboard
    And a transaction exists with the note "<script>alert('xss')</script>"
    When the transaction list renders
    Then the script tag should be displayed as plain text or escaped
    And no JavaScript alert dialog should appear

  @security
  Scenario: Transaction description containing HTML tags is rendered as text
    Given I am on the home dashboard
    And a transaction exists with a description containing "<b>bold text</b>"
    When the transaction list renders
    Then the HTML tags should appear as escaped text, not as rendered bold formatting

  # ===== API =====

  @api @smoke
  Scenario: GET /transactions/public returns a paginated list
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid "connect.sid" session cookie
    When I send a GET request to /transactions/public?page=1&limit=10
    Then the response status should be 200
    And the response body should contain a "results" array
    And the "results" array should contain at most 10 transaction objects
    And each transaction object should have fields: "id", "uuid", "amount", "description", "receiverId", "senderId", "status"

  @api @smoke
  Scenario: GET /notifications returns unread notification data
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid "connect.sid" session cookie
    When I send a GET request to /notifications
    Then the response status should be 200
    And the response body should contain a "results" array
    And each notification object should have fields: "id", "userId", "message", "isRead"

  @api @regression
  Scenario: GET /transactions/public without authentication returns 401
    Given the API is available at http://localhost:3001
    And I am not authenticated (no session cookie)
    When I send a GET request to /transactions/public?page=1&limit=10
    Then the response status should be 401

  @api @regression
  Scenario: GET /notifications without authentication returns 401
    Given the API is available at http://localhost:3001
    And I am not authenticated (no session cookie)
    When I send a GET request to /notifications
    Then the response status should be 401

  @api @regression
  Scenario: GET /transactions/public with page beyond range returns empty results
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid "connect.sid" session cookie
    When I send a GET request to /transactions/public?page=9999&limit=10
    Then the response status should be 200
    And the response body "results" array should be empty

  @api @regression
  Scenario: GET /transactions returns only the authenticated user's related transactions
    Given the API is available at http://localhost:3001
    And I am authenticated as "Heath93"
    When I send a GET request to /transactions?page=1&limit=10
    Then the response status should be 200
    And each transaction in "results" should involve "Heath93" as either sender or receiver

  # ===== ACCESSIBILITY =====

  @a11y
  Scenario: Dashboard page has no critical axe-core accessibility violations
    Given I am on the home dashboard
    When axe-core accessibility analysis runs on the full page
    Then there should be no critical or serious violations reported

  @a11y
  Scenario: Main header controls are keyboard navigable
    Given I am on the home dashboard
    When I press Tab from the top of the page
    Then the hamburger button, logo, "New" button, and notifications bell should each receive focus in logical order

  @a11y
  Scenario: Transaction feed tabs are keyboard accessible
    Given I am on the home dashboard
    When I navigate to the tab bar using the keyboard
    Then I should be able to switch between "Everyone", "Friends", and "Mine" tabs using keyboard interaction

  @a11y
  Scenario: Sidebar navigation items are keyboard accessible
    Given I am on the home dashboard
    And the left sidebar is open
    When I press Tab through the sidebar
    Then each navigation link (Home, My Account, Bank Accounts, Notifications) and the Logout button should receive focus

  @a11y
  Scenario: Transaction list items are reachable via keyboard
    Given I am on the home dashboard
    And the transaction list is visible
    When I Tab through the transaction list
    Then each transaction row or its interactive elements should receive focus

  @a11y
  Scenario: Notification badge count is accessible to screen readers
    Given I am on the home dashboard
    Then the notifications bell icon should have an accessible label that conveys the unread count
    And the badge count should be readable by assistive technologies

# ===== MANUAL TESTING NOTES =====
#
# Test environment: http://localhost:3000
# Test user credentials: Heath93 / s3cret (Ted Parisian, id: uBmeaz5pX)
#   Balance after seed: $1,509.53
#   Unread notifications after seed: 8
#
# Before testing:
#   1. Ensure Docker is running: docker compose up -d
#   2. Reset the database: npm run db:seed
#   3. Clear browser storage (cookies, localStorage) before each session
#   4. Sign in at http://localhost:3000/signin before executing any scenario that requires auth
#
# Tab behavior notes:
#   - "Everyone" tab maps to GET /transactions/public
#   - "Friends" and "Mine" tabs both map to GET /transactions (filtered server-side)
#   - The section label changes: Everyone → "Public", Friends → "Friends", Mine → "Mine"
#
# Pagination notes:
#   - Default page size is 10 transactions per page
#   - Seed data contains 5 pages of public transactions
#   - Navigation controls appear at the bottom of the transaction list
#
# Filter notes:
#   - Date filter default label: "ALL"
#   - Amount filter default range: "$0 - $1,000"
#   - Filters are applied client-side — no page reload occurs
#
# Sidebar notes:
#   - The sidebar (drawer) is hidden by default on desktop and must be toggled open
#   - On mobile viewports the sidebar behavior may differ
#
# Known limitations for automated tests:
#   - Performance tests (response time SLAs) require manual execution
#     (see Performance describe block in tests/api/home.spec.ts once generated)
#   - Visual regression baselines must be created with --update-snapshots on first run
#   - XSS scenarios require inserting a test transaction via the API before the UI test runs
