Feature: Sign In
  As a registered user
  I want to sign in with my username and password
  So that I can access my account and manage my transactions

  Background:
    Given the application is running at http://localhost:3000
    And the database has been seeded with known test data
    And I am on the sign in page at http://localhost:3000/signin

  # ===== HAPPY PATH =====

  @smoke
  Scenario: Successful sign in with valid credentials
    Given I am not signed in
    When I enter "Heath93" in the Username field
    And I enter "s3cret" in the Password field
    And I click the "SIGN IN" button
    Then I should be redirected away from the sign in page
    And I should see my account dashboard

  @smoke
  Scenario: Session cookie is set after successful sign in
    Given I am not signed in
    When I enter "Heath93" in the Username field
    And I enter "s3cret" in the Password field
    And I click the "SIGN IN" button
    Then a "connect.sid" session cookie should be set in my browser
    And the cookie should persist for the duration of my session

  @smoke
  Scenario: Sign up link navigates to the registration page
    Given I am on the sign in page
    When I click the "Don't have an account? Sign Up" link
    Then I should be on the sign up page at http://localhost:3000/signup

  # ===== EDGE CASES =====

  @regression
  Scenario Outline: Sign in is blocked when required fields are empty or whitespace
    Given I am not signed in
    When I enter "<username>" in the Username field
    And I enter "<password>" in the Password field
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And I should see "<expected_outcome>"

    Examples:
      | username | password | expected_outcome                          |
      |          |          | Username field is required                |
      |          | s3cret   | Username field is required                |
      | Heath93  |          | Password field is required                |
      |          |          | Sign In button does not submit the form   |

  @regression
  Scenario Outline: Sign in fails with incorrect credentials
    Given I am not signed in
    When I enter "<username>" in the Username field
    And I enter "<password>" in the Password field
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And I should see an error message below the "SIGN IN" button

    Examples:
      | username       | password        |
      | Heath93        | wrongpassword   |
      | wronguser      | s3cret          |
      | wronguser      | wrongpassword   |
      | HEATH93        | s3cret          |
      | heath93        | s3cret          |

  @regression
  Scenario: Username field accepts long input without breaking the form
    Given I am not signed in
    When I enter a username that is 255 characters long
    And I enter "s3cret" in the Password field
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And the form should not crash or display a blank screen

  @regression
  Scenario: Password field masks characters as the user types
    Given I am on the sign in page
    When I type any characters into the Password field
    Then each character should appear as a bullet or asterisk, not as plain text

  @regression
  Scenario: Sign in page is accessible without an existing session
    Given I have no active session cookie
    When I navigate directly to http://localhost:3000/signin
    Then I should see the sign in form without being redirected

  @regression
  Scenario: Already signed-in user is redirected away from sign in page
    Given I have already signed in as "Heath93"
    When I navigate directly to http://localhost:3000/signin
    Then I should be redirected to the home or dashboard page
    And I should not see the sign in form

  # ===== NEGATIVE CASES =====

  @regression
  Scenario: Sign in fails for a username that does not exist
    Given I am not signed in
    When I enter "nonexistentuser99999" in the Username field
    And I enter "anypassword" in the Password field
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And I should see an error message below the "SIGN IN" button
    And the error message should not reveal whether the username exists

  @regression
  Scenario: Sign in fails when password is correct but username has wrong case
    Given I am not signed in
    When I enter "HEATH93" in the Username field
    And I enter "s3cret" in the Password field
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And I should see an error message below the "SIGN IN" button

  @regression
  Scenario: Sign in fails for a deleted or inactive account
    Given a user account has been removed from the system
    When I enter that deleted user's username in the Username field
    And I enter that user's password in the Password field
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And I should see an error message below the "SIGN IN" button

  # ===== SECURITY =====

  @security
  Scenario Outline: XSS payloads in the username field do not execute
    Given I am not signed in
    When I enter "<xss_payload>" in the Username field
    And I enter "anypassword" in the Password field
    And I click the "SIGN IN" button
    Then no script should execute in the browser
    And the page should remain stable with an error message or rejected form

    Examples:
      | xss_payload                                      |
      | <script>alert('xss')</script>                    |
      | <img src=x onerror=alert(1)>                     |
      | javascript:alert(1)                              |
      | "><svg onload=alert(1)>                          |

  @security
  Scenario Outline: XSS payloads in the password field do not execute
    Given I am not signed in
    When I enter "Heath93" in the Username field
    And I enter "<xss_payload>" in the Password field
    And I click the "SIGN IN" button
    Then no script should execute in the browser
    And the page should remain stable

    Examples:
      | xss_payload                   |
      | <script>alert('xss')</script> |
      | ' OR '1'='1                   |
      | " OR "1"="1                   |

  @security
  Scenario: Error messages do not reveal whether a username exists (user enumeration)
    Given I am not signed in
    When I attempt to sign in with a username that does not exist and any password
    Then the error message should be identical to the error shown for a wrong password on a valid username
    And the response should not distinguish between "user not found" and "wrong password"

  @security
  Scenario: Password field value is not visible in the page source or DOM as plain text
    Given I am on the sign in page
    When I type "s3cret" into the Password field
    Then the input field type should be "password"
    And the value should not be readable as plain text by inspecting the DOM

  @security
  Scenario: Submitting the sign in form over HTTP does not expose credentials in the URL
    Given I am on the sign in page
    When I complete and submit the sign in form
    Then the username and password should not appear in the browser address bar or URL query string

  @security
  Scenario: The session cookie is set with appropriate security attributes
    Given I sign in successfully as "Heath93"
    When I inspect the "connect.sid" cookie
    Then the cookie should have the HttpOnly attribute set
    And the cookie should not be accessible via JavaScript

  @security
  Scenario: SQL injection in the username field does not bypass authentication
    Given I am not signed in
    When I enter "' OR 1=1 --" in the Username field
    And I enter "anything" in the Password field
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And I should not be signed in as any user

  # ===== API FUNCTIONAL =====

  @api @smoke
  Scenario: POST /login returns 200 and user object for valid credentials
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with body:
      """
      { "username": "Heath93", "password": "s3cret" }
      """
    Then the response status should be 200
    And the response body should be JSON containing a "user" object
    And the "user" object should include fields: "id", "username", "firstName", "lastName"
    And the response should set a "connect.sid" cookie

  @api @smoke
  Scenario: POST /login sets a connect.sid session cookie on success
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with valid credentials
    Then the response headers should include "Set-Cookie"
    And the "Set-Cookie" header should contain "connect.sid"

  @api @regression
  Scenario: POST /login returns 401 with plain text body for wrong password
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with body:
      """
      { "username": "Heath93", "password": "wrongpassword" }
      """
    Then the response status should be 401
    And the response body should be the plain text string "Unauthorized"
    And the response body should NOT be JSON

  @api @regression
  Scenario: POST /login returns 401 for a username that does not exist
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with body:
      """
      { "username": "nosuchuser99999", "password": "anypassword" }
      """
    Then the response status should be 401
    And the response body should be the plain text string "Unauthorized"

  @api @regression
  Scenario: POST /login returns 400 when username field is missing
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with body:
      """
      { "password": "s3cret" }
      """
    Then the response status should be 400
    And the response body should be the plain text string "Bad Request"

  @api @regression
  Scenario: POST /login returns 400 when password field is missing
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with body:
      """
      { "username": "Heath93" }
      """
    Then the response status should be 400
    And the response body should be the plain text string "Bad Request"

  @api @regression
  Scenario: POST /login returns 400 when the request body is empty
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with an empty body
    Then the response status should be 400
    And the response body should be the plain text string "Bad Request"

  @api @regression
  Scenario: POST /login does not accept GET requests
    Given the API is available at http://localhost:3001
    When I send a GET request to /login
    Then the response status should be 404 or 405
    And no session cookie should be set

  @api @security
  Scenario: POST /login response does not include the user's password in the response body
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with valid credentials
    Then the response status should be 200
    And the "user" object in the response body should NOT contain a "password" field
    And the "user" object should NOT contain a "hashedPassword" field

  # ===== ACCESSIBILITY =====

  @a11y
  Scenario: Sign in page is keyboard navigable in logical tab order
    Given I am on the sign in page
    When I press Tab starting from the top of the page
    Then the focus should move to the Username field first
    And pressing Tab again should move focus to the Password field
    And pressing Tab again should move focus to the "SIGN IN" button
    And pressing Tab again should move focus to the "Don't have an account? Sign Up" link

  @a11y
  Scenario: Sign in form can be submitted using the keyboard alone
    Given I am on the sign in page
    And I have typed "Heath93" in the Username field using the keyboard
    And I have typed "s3cret" in the Password field using the keyboard
    When I press Enter while the "SIGN IN" button has focus
    Then the form should submit
    And I should be redirected to the dashboard

  @a11y
  Scenario: Username and Password fields have visible labels or accessible names
    Given I am on the sign in page
    When a screen reader reads the Username input field
    Then it should announce the field as "Username" or equivalent
    When a screen reader reads the Password input field
    Then it should announce the field as "Password" or equivalent

  @a11y
  Scenario: Error message is announced to screen reader users after a failed sign in
    Given I am not signed in
    When I submit the sign in form with incorrect credentials
    Then the error message that appears below the "SIGN IN" button should be associated with the form
    And a screen reader should be able to announce the error without the user having to search for it

  @a11y
  Scenario: Sign in page has sufficient color contrast for all text
    Given I am on the sign in page
    When I check the color contrast of all visible text elements
    Then every text element should meet WCAG 2.1 AA minimum contrast ratio of 4.5:1 for normal text
    And 3:1 for large text

  @a11y
  Scenario: Focus indicator is visible on all interactive elements
    Given I am on the sign in page
    When I tab through the page
    Then each focused element should display a clearly visible focus outline or indicator

  # ===== REMEMBER ME — HAPPY PATH =====

  @smoke
  Scenario: Checking "Remember me" causes the session cookie to persist beyond the browser session
    Given I am not signed in
    And I am on the sign in page
    When I enter "Heath93" in the Username field
    And I enter "s3cret" in the Password field
    And I check the "Remember me" checkbox
    And I click the "SIGN IN" button
    Then I should be signed in and redirected to the dashboard
    And the "connect.sid" cookie should have a Max-Age or Expires attribute set approximately 30 days in the future
    And the cookie should still be present after simulating a browser restart (clearing session state only)

  @smoke
  Scenario: Leaving "Remember me" unchecked causes the cookie to expire when the browser session ends
    Given I am not signed in
    And I am on the sign in page
    When I enter "Heath93" in the Username field
    And I enter "s3cret" in the Password field
    And I leave the "Remember me" checkbox unchecked
    And I click the "SIGN IN" button
    Then I should be signed in and redirected to the dashboard
    And the "connect.sid" cookie should have no Max-Age or Expires attribute
    And the cookie should be a session cookie that disappears when the browser session ends

  # ===== REMEMBER ME — API =====

  @api @smoke
  Scenario: POST /login with remember:true sets a persistent cookie
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with body:
      """
      { "username": "Heath93", "password": "s3cret", "remember": true }
      """
    Then the response status should be 200
    And the "Set-Cookie" response header should contain "connect.sid"
    And the "connect.sid" cookie should include a "Max-Age" or "Expires" attribute indicating a 30-day lifetime

  @api @smoke
  Scenario: POST /login without a remember field sets a session-only cookie
    Given the API is available at http://localhost:3001
    When I send a POST request to /login with body:
      """
      { "username": "Heath93", "password": "s3cret" }
      """
    Then the response status should be 200
    And the "Set-Cookie" response header should contain "connect.sid"
    And the "connect.sid" cookie should NOT include a "Max-Age" or "Expires" attribute

  # ===== REMEMBER ME — EDGE CASES =====

  @regression
  Scenario: The "Remember me" checkbox is unchecked by default when the page loads
    Given I navigate to the sign in page
    When the page has fully loaded
    Then the "Remember me" checkbox should be unchecked
    And no prior selection should be retained from a previous visit

  @regression
  Scenario: The "Remember me" checkbox can be toggled on and off before submitting
    Given I am on the sign in page
    When I check the "Remember me" checkbox
    Then the checkbox should appear checked
    When I uncheck the "Remember me" checkbox
    Then the checkbox should appear unchecked
    And I should be able to submit the form with the checkbox in its final state

  @regression
  Scenario: The "Remember me" checkbox is operable using the keyboard alone
    Given I am on the sign in page
    When I tab to the "Remember me" checkbox
    Then the checkbox should receive visible keyboard focus
    When I press Space
    Then the checkbox should become checked
    When I press Space again
    Then the checkbox should become unchecked

  # ===== REMEMBER ME — SECURITY =====

  @security
  Scenario: A failed sign in with "Remember me" checked does not set a persistent cookie
    Given I am not signed in
    And I am on the sign in page
    When I enter "Heath93" in the Username field
    And I enter "wrongpassword" in the Password field
    And I check the "Remember me" checkbox
    And I click the "SIGN IN" button
    Then I should remain on the sign in page
    And I should see an error message below the "SIGN IN" button
    And no "connect.sid" cookie should be set in my browser

  @security
  Scenario: A persistent cookie created with remember-me cannot be used after it is invalidated server-side
    Given I have signed in with "Remember me" checked and received a persistent "connect.sid" cookie
    When the server invalidates that session (e.g., via sign out or session purge)
    And I make an authenticated request to the API using the old cookie value
    Then the response status should be 401 or 302 redirect to the sign in page
    And I should not be able to access protected resources with the old cookie

  # ===== DON'T HAVE AN ACCOUNT LINK — HAPPY PATH =====

  @smoke
  Scenario: The "Don't have an account? Sign Up" link is visible on the sign in page
    Given I am on the sign in page
    Then I should see the text "Don't have an account? Sign Up"
    And the link should point to "/signup"

  @smoke
  Scenario: Navigating to /signup via the browser loads the sign up form
    Given I am on the sign in page
    And I can see the "Don't have an account? Sign Up" link pointing to "/signup"
    When I navigate directly to http://localhost:3000/signup
    Then I should see the sign up registration form
    And the page URL should be http://localhost:3000/signup

  # ===== DON'T HAVE AN ACCOUNT LINK — EDGE CASES =====

  @regression
  Scenario: The "Don't have an account? Sign Up" link href is correct and stable before any field interaction
    Given I am on the sign in page and I have not clicked or typed in any field
    When I inspect the "Don't have an account? Sign Up" link
    Then the link should have an href attribute equal to "/signup"

  @regression
  Scenario: The "Don't have an account? Sign Up" link href remains correct after the user has typed in the Username field
    Given I am on the sign in page
    When I click on the Username field and type any text
    And I move focus away from the Username field (triggering Formik onBlur validation)
    Then the "Don't have an account? Sign Up" link should still be present in the page
    And it should still have an href attribute equal to "/signup"

  # ===== DON'T HAVE AN ACCOUNT LINK — SECURITY =====

  @security
  Scenario: The sign up link does not contain an open redirect to an external domain
    Given I am on the sign in page
    When I inspect the "Don't have an account? Sign Up" link
    Then the href should be a relative path "/signup" or the same-origin absolute URL
    And the href should NOT point to an external domain or contain a redirect parameter

  # ===== DON'T HAVE AN ACCOUNT LINK — ACCESSIBILITY =====

  @a11y
  Scenario: The "Don't have an account? Sign Up" link is announced correctly by screen readers
    Given I am on the sign in page
    When a screen reader focuses on the "Don't have an account? Sign Up" link
    Then it should announce the full visible link text "Don't have an account? Sign Up"
    And the element should be identified as a link, not a button or generic element

  @a11y
  Scenario: The "Don't have an account? Sign Up" link is reachable by keyboard Tab navigation
    Given I am on the sign in page
    When I tab through all interactive elements on the page
    Then the "Don't have an account? Sign Up" link should receive focus at some point during Tab traversal
    And it should display a visible focus indicator when focused


# ===== MANUAL TESTING NOTES =====
#
# Test environment: http://localhost:3000 (UI)  |  http://localhost:3001 (API)
# Test credentials: see .env (TEST_USER_USERNAME / TEST_USER_PASSWORD)
# Primary seed user: Heath93 / s3cret
#
# Before testing:
#   1. Ensure Docker is running:  docker compose up -d
#   2. Reset the database:        npm run db:seed
#   3. Clear browser cookies and local storage before each test session
#      (DevTools → Application → Storage → Clear site data)
#
# API testing tips:
#   - Use curl, Postman, or the Playwright API test suite (tests/api/signin.spec.ts)
#   - The 401 and 400 responses return plain text, NOT JSON — do not parse them as JSON
#   - To verify the connect.sid cookie, inspect Set-Cookie response headers
#
# Security testing tips:
#   - XSS: paste payloads manually and watch the browser console for any alert() calls
#   - User enumeration: compare response bodies and timings for unknown vs known usernames
#   - SQL injection: the form should always reject and return an error, never succeed
#
# Accessibility testing tips:
#   - Use NVDA (Windows), VoiceOver (macOS), or TalkBack (Android) to verify screen reader output
#   - Browser extension: axe DevTools or Deque's browser extension for automated WCAG checks
#   - Tab order: start with keyboard focus on the browser address bar, then Tab into the page
#
# Known limitations for automated tests:
#   - Rate limiting tests require manual execution or dedicated tooling
#   - Visual regression baselines must be created with --update-snapshots on first run
#   - Screen reader announcements must be verified manually; axe-core checks structure only
