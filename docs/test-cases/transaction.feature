Feature: Transaction Detail
  As a signed-in user
  I want to view the detail page for a single transaction
  So that I can see the full context, like the transaction, and leave a comment

  Background:
    Given the application is running at http://localhost:3000
    And the database has been seeded with known test data
    And I am signed in as "Heath93" with password "s3cret"
    And I have navigated to the home dashboard at http://localhost:3000/

  # ===== HAPPY PATH =====

  @smoke
  Scenario: User views the full detail of a transaction from the home feed
    Given at least one transaction is visible in the home feed
    When I click on any transaction row
    Then the URL should change to "/transaction/{id}" where {id} is the transaction ID
    And I should see the sender's name on the page
    And I should see the receiver's name on the page
    And I should see the transaction description
    And I should see the transaction amount formatted with a "+" or "-" sign

  @smoke
  Scenario: Transaction amount is displayed with correct sign and formatting
    Given I am on the detail page for a completed "pay" transaction where I am the receiver
    Then the amount should be displayed with a "+" prefix (e.g. "+$50.00")

  @smoke
  Scenario: Transaction amount shows negative sign for the sender
    Given I am on the detail page for a completed "pay" transaction where I am the sender
    Then the amount should be displayed with a "-" prefix (e.g. "-$50.00")

  @smoke
  Scenario: Transaction detail page shows the like button and current like count
    Given I am on any transaction detail page
    Then I should see a like button
    And I should see the current number of likes next to the like button

  @smoke
  Scenario: Transaction detail page shows the comment input field
    Given I am on any transaction detail page
    Then I should see a comment input field
    And the placeholder text or label should indicate where to type a comment

  @smoke
  Scenario: Existing comments are visible on the transaction detail page
    Given I am on the detail page for a transaction that already has at least one comment
    Then I should see each comment's text content displayed below the transaction summary

  # ===== NAVIGATION =====

  @smoke
  Scenario: Clicking a transaction row in the home feed navigates to its detail page
    Given I am on the home dashboard
    And the home feed shows at least one transaction row
    When I click the first transaction row
    Then I should be taken to the transaction detail page for that transaction
    And the URL should match the pattern "/transaction/<id>"
    And the transaction sender, receiver, and amount on the detail page should match what was shown in the feed row

  @regression
  Scenario: Back navigation returns user to the home feed
    Given I have navigated to a transaction detail page from the home feed
    When I press the browser back button
    Then I should be returned to the home dashboard at "/"
    And the transaction feed should still be visible

  @regression
  Scenario: Direct URL navigation to a valid transaction detail page works
    Given I know the ID of an existing transaction (e.g. "abc123")
    When I navigate directly to "/transaction/abc123"
    Then the transaction detail page should load
    And I should see the sender name, receiver name, description, and amount for that transaction

  # ===== LIKE FEATURE =====

  @smoke
  Scenario: User likes a transaction and the like count increments
    Given I am on a transaction detail page that I have not yet liked
    And I note the current like count (e.g. "2")
    When I click the like button
    Then the like count should increase by 1 (e.g. to "3")

  @regression
  Scenario: Like button becomes disabled after the user likes a transaction
    Given I am on a transaction detail page that I have not yet liked
    When I click the like button
    Then the like button should become disabled
    And I should not be able to click it again to unlike

  @regression
  Scenario: Transaction with zero likes shows a like count of 0
    Given I am on the detail page for a transaction that has never been liked
    Then the like count shown next to the like button should be "0"

  @regression @skip
  Scenario: Like is persisted after page reload (BUG-TXN-001)
    # BUG-TXN-001: The UI sends POST /transactions/{id}/like (404). The correct
    # endpoint is POST /likes/{transactionId}. The like count increments in the UI
    # due to optimistic update, but the like is NOT saved server-side.
    # Skip this scenario until the UI calls the correct endpoint.
    Given I am on a transaction detail page that I have not yet liked
    When I click the like button
    And I reload the page
    Then the like count should still show the incremented value
    And the like button should still be disabled

  # ===== COMMENT FEATURE =====

  @smoke
  Scenario: User submits a comment and it appears in the comments list
    Given I am on any transaction detail page
    When I click the comment input field
    And I type "Great transaction!"
    And I press Enter to submit
    Then the comment "Great transaction!" should appear in the comments list below the input

  @regression
  Scenario: Comment input is cleared after submission
    Given I am on any transaction detail page
    When I type "Test comment" in the comment input and press Enter
    Then the comment input field should be empty after the comment is submitted

  @regression
  Scenario: Multiple comments appear in the comments list in order
    Given I am on any transaction detail page
    When I submit the comment "First comment"
    And I submit the comment "Second comment"
    Then I should see "First comment" in the comments list
    And I should see "Second comment" in the comments list

  @regression
  Scenario: Transaction with no comments shows an empty comments section
    Given I am on the detail page for a transaction that has no comments
    Then the comments list should be empty or not visible
    And the comment input field should still be available for me to type in

  @regression @skip
  Scenario: Comment submitted via keyboard Enter key is persisted (BUG-TXN-002)
    # BUG-TXN-002: Enter key submission may not fire in some test contexts.
    # The POST /comments/{transactionId} API endpoint works correctly when called
    # directly. Skip this scenario in automated runs until the keyboard handler is stable.
    Given I am on any transaction detail page
    When I type a comment using the keyboard and press Enter
    Then the comment should be submitted via POST /comments/{transactionId}
    And the comment should appear in the list after page reload

  # ===== EDGE CASES =====

  @regression
  Scenario Outline: Transaction detail shows correct verb based on status
    Given I am on the detail page for a transaction with status "<status>"
    Then the page should display the verb "<verb>" between the sender and receiver names

    Examples:
      | status   | verb      |
      | complete | paid      |
      | pending  | requested |

  @regression
  Scenario: Pending transaction shows pending status indicator
    Given I am on the detail page for a transaction with "pending" requestStatus
    Then I should see a visual indicator that the transaction is pending (e.g. a badge or label)

  @regression
  Scenario: Completed transaction shows no pending indicator
    Given I am on the detail page for a transaction with "complete" status
    Then I should not see any "pending" label or badge on the page

  @regression
  Scenario: Transaction with a long description renders without overflow
    Given I am on the detail page for a transaction whose description is longer than 100 characters
    Then the description text should be fully visible or truncated cleanly without breaking the layout

  # ===== SECURITY =====

  @security
  Scenario: Unauthenticated user is redirected to sign in when accessing a transaction detail page
    Given I am NOT signed in (no active session)
    When I navigate directly to "/transaction/some-valid-id"
    Then I should be redirected to "/signin"
    And I should not see any transaction data

  @security @skip
  Scenario: IDOR — user cannot view another user's private transaction by guessing the ID
    # BUG-TXN-SEC-001: the API currently lets user B read user A's private
    # transaction (GET /transactions/{id} returns 200 with full details instead
    # of 404/403). This scenario documents the intended secure behavior; the
    # automated test is skipped until the app enforces ownership.
    Given user A has a private transaction with a known ID
    And I am signed in as user B (who is not involved in that transaction)
    When I navigate directly to "/transaction/<user-A-transaction-id>"
    Then I should either see a 404 page, an access denied message, or be redirected
    And I should not see user A's private transaction details

  @security
  Scenario: XSS payload in a comment does not execute as script
    Given I am on any transaction detail page
    When I submit a comment containing the text "<script>alert('xss')</script>"
    Then the comment should appear in the list as plain text
    And no JavaScript alert or script should execute on the page

  @security
  Scenario: XSS payload in the transaction description does not execute as script
    Given I am on the detail page for a transaction whose description contains "<img src=x onerror=alert(1)>"
    Then the description should render as plain text or sanitized HTML
    And no JavaScript alert or script should execute on the page

  @security
  Scenario: Like button cannot be triggered by a different logged-in user's API call (CSRF check)
    Given I am signed in as "Heath93"
    When a forged POST request is sent to "/likes/{transactionId}" without a valid session cookie
    Then the API should return a 401 Unauthorized response
    And the like count for that transaction should not change

  # ===== API FUNCTIONAL =====

  @api @smoke
  Scenario: GET /transactions/{id} returns the full transaction object for a valid ID
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a GET request to "/transactions/{id}" for a known transaction ID
    Then the response status should be 200
    And the response body should contain a "transaction" key
    And "transaction.id" should match the requested ID
    And "transaction.senderName" should be a non-empty string
    And "transaction.receiverName" should be a non-empty string
    And "transaction.amount" should be a number
    And "transaction.description" should be a string
    And "transaction.likes" should be an array
    And "transaction.comments" should be an array

  @api @smoke
  Scenario: POST /likes/{transactionId} creates a like and returns 200
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    And I have a transaction ID that the current user has not yet liked
    When I send a POST request to "/likes/{transactionId}"
    Then the response status should be 200

  @api @smoke
  Scenario: POST /comments/{transactionId} creates a comment and returns 200
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a POST request to "/comments/{transactionId}" with body:
      """
      { "content": "This is a test comment" }
      """
    Then the response status should be 200
    And a subsequent GET /transactions/{transactionId} should include the new comment in "transaction.comments"

  # ===== API ERROR HANDLING =====

  @api @regression @skip
  Scenario: GET /transactions/{id} returns 404 for a non-existent transaction ID
    # BUG-TXN-API-001: the endpoint currently returns 200 (with an empty/partial
    # body) for IDs that do not exist, instead of 404. BUG-TXN-UI-001 is the UI
    # symptom — navigating to an unknown /transaction/{id} shows no error and no
    # redirect. This scenario documents the intended behavior; skipped until fixed.
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a GET request to "/transactions/does-not-exist-id"
    Then the response status should be 404

  @api @regression
  Scenario: GET /transactions/{id} returns 401 when no session cookie is present
    Given the API is available at http://localhost:3001
    And I am NOT authenticated (no session cookie)
    When I send a GET request to "/transactions/{id}" for a known transaction ID
    Then the response status should be 401

  @api @regression
  Scenario: POST /likes/{transactionId} returns 401 when no session is present
    Given the API is available at http://localhost:3001
    And I am NOT authenticated (no session cookie)
    When I send a POST request to "/likes/{transactionId}"
    Then the response status should be 401

  @api @regression
  Scenario: POST /comments/{transactionId} returns 401 when no session is present
    Given the API is available at http://localhost:3001
    And I am NOT authenticated (no session cookie)
    When I send a POST request to "/comments/{transactionId}" with body:
      """
      { "content": "This should be rejected" }
      """
    Then the response status should be 401

  @api @regression
  Scenario: POST /comments/{transactionId} with an empty content field is rejected
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a POST request to "/comments/{transactionId}" with body:
      """
      { "content": "" }
      """
    Then the response status should be 400 or 422
    And the response should indicate that content is required

  @api @regression
  Scenario: POST /comments/{transactionId} with no body is rejected
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a POST request to "/comments/{transactionId}" with an empty body
    Then the response status should be 400 or 422

  # ===== API CONTRACT =====

  @api @contract
  Scenario: GET /transactions/{id} response matches the expected schema
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a GET request to "/transactions/{id}" for a known transaction ID
    Then the response body must match this schema:
      """
      {
        "transaction": {
          "id": string,
          "senderName": string,
          "receiverName": string,
          "amount": number,
          "description": string,
          "status": string (one of: "pending", "complete"),
          "requestStatus": string or null,
          "privacyLevel": string,
          "likes": [{ "id": string, "userId": string }],
          "comments": [{ "id": string, "content": string }]
        }
      }
      """

  # ===== API PERFORMANCE =====

  @api @performance
  Scenario: GET /transactions/{id} responds within the SLA
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a GET request to "/transactions/{id}" for a known transaction ID
    Then the response should be received within 500 milliseconds

  @api @performance
  Scenario: POST /likes/{transactionId} responds within the SLA
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a POST request to "/likes/{transactionId}"
    Then the response should be received within 500 milliseconds

  @api @performance
  Scenario: POST /comments/{transactionId} responds within the SLA
    Given the API is available at http://localhost:3001
    And I am authenticated with a valid session cookie
    When I send a POST request to "/comments/{transactionId}" with a valid comment body
    Then the response should be received within 500 milliseconds

  # ===== ACCESSIBILITY =====

  @a11y
  Scenario: Transaction detail page has a clear heading hierarchy
    Given I am on any transaction detail page
    Then there should be at least one heading (h1 or h2) that identifies the page content
    And headings should not skip levels (e.g. h1 → h3 with no h2)

  @a11y
  Scenario: Like button has an accessible label
    Given I am on any transaction detail page
    Then the like button should have an accessible name (e.g. "Like", "Like this transaction")
    So that screen reader users know what the button does

  @a11y
  Scenario: Like button disabled state is communicated to assistive technology
    Given I have already liked a transaction on its detail page
    Then the like button should have "aria-disabled" set to "true" or have the HTML "disabled" attribute
    So that screen reader users know the button is no longer actionable

  @a11y
  Scenario: Comment input field has a visible label or aria-label
    Given I am on any transaction detail page
    Then the comment input should have an associated label or an "aria-label" attribute
    So that screen reader users understand the purpose of the field

  @a11y
  Scenario: Page is keyboard navigable — user can reach the like button and comment field without a mouse
    Given I am on a transaction detail page
    When I press Tab repeatedly from the top of the page
    Then focus should visibly move through interactive elements in a logical order
    And I should be able to reach the like button using Tab
    And I should be able to reach the comment input field using Tab

  @a11y
  Scenario: Transaction amount color contrast meets WCAG 2.1 AA
    Given I am on a transaction detail page
    Then the transaction amount text should have a color contrast ratio of at least 4.5:1 against its background

  @a11y
  Scenario: Page passes automated axe-core accessibility scan with no critical violations
    Given I am on any transaction detail page
    When an automated accessibility scan (axe-core) is run on the page
    Then there should be no "critical" or "serious" accessibility violations

# ===== MANUAL TESTING NOTES =====
#
# Test environment: http://localhost:3000 (UI), http://localhost:3001 (API)
# Test user credentials: Heath93 / s3cret (Ted Parisian, id: uBmeaz5pX)
#
# Before testing:
#   1. Ensure Docker is running:        docker compose up -d
#   2. Reset the database to seed data: npm run db:seed
#   3. Clear browser storage (cookies + localStorage) before each new test session
#
# Finding a valid transaction ID for manual tests:
#   - Sign in, go to http://localhost:3000/
#   - Click any row in the feed — the URL will change to /transaction/<id>
#   - Copy the <id> from the URL bar
#
# Known bugs to be aware of during manual testing:
#
#   BUG-TXN-001 (Like persistence):
#     The like button becomes visually disabled after clicking (optimistic UI update),
#     but the like is NOT persisted to the server. The UI calls
#     POST /transactions/{id}/like which returns 404. The correct endpoint is
#     POST /likes/{transactionId}. If you reload after liking, the count resets.
#     Affected scenarios are tagged @skip.
#
#   BUG-TXN-002 (Comment keyboard submission):
#     Pressing Enter to submit a comment may fail in automated test contexts
#     even though the API endpoint (POST /comments/{transactionId}) works correctly.
#     To verify comments manually: type in the comment field and press Enter;
#     the comment should appear immediately in the list without a page reload.
#
#   BUG-TXN-UI-001 (Unknown transaction ID — no error/redirect):
#     Navigating directly to /transaction/<nonexistent-id> shows no content and
#     no error, and does not redirect. The "Transaction Detail" header never
#     appears. See docs/bug-reports/transaction-bugs.md.
#
#   BUG-TXN-API-001 (GET /transactions/{id} returns 200 for non-existent IDs):
#     The endpoint returns 200 instead of 404 for IDs that do not exist.
#     Affected scenario is tagged @skip.
#
#   BUG-TXN-SEC-001 (IDOR on private transactions):
#     GET /transactions/{id} lets an unrelated user read another user's private
#     transaction (returns 200 with full details) instead of 404/403.
#     Affected scenario is tagged @skip.
#
#   BUG-TXN-UI-002 (Transaction-detail card re-renders into a skeleton):
#     The card re-renders into a loading/skeleton state after the data first
#     paints; under concurrent load this makes a pixel snapshot non-deterministic.
#     The @visual snapshot test is skipped; card content is covered by @smoke.
#
# For IDOR security testing:
#   - Seed two different user accounts
#   - Create a private transaction as user A
#   - Log in as user B and attempt to navigate to /transaction/<user-A-id> directly
#
# For API tests:
#   - Session cookie is named "connect.sid" — copy it from DevTools → Application → Cookies
#   - Rate limiting tests should be run manually (they require bursting requests quickly)
#   - Performance SLA is 500ms p95 — run with a local DB for accurate results
#
# Running automated tests for this feature:
#   npm run test:ui       -- runs tests/ui/transaction.spec.ts
#   npm run test:api      -- runs tests/api/transaction.spec.ts
#   npm run test:smoke    -- runs all @smoke tagged tests across all features
#   npm run test:a11y     -- runs all @a11y tagged tests (weekly CI + nightly)
