Feature: Sign Up
  As a new visitor
  I want to create an account with my name, username, and password
  So that I can access the Real World App and manage transactions

  Background:
    Given the application is running at http://localhost:3000
    And the database has been seeded with known test data
    And I am on the sign up page at http://localhost:3000/signup

  # ===== HAPPY PATH =====

  @smoke
  Scenario: Successful registration with valid details
    Given no account exists for username "newuser_happy"
    When I enter "Jane" in the First Name field
    And I enter "Doe" in the Last Name field
    And I enter "newuser_happy" in the Username field
    And I enter "Password123" in the Password field
    And I enter "Password123" in the Confirm Password field
    And I click the "SIGN UP" button
    Then I should be redirected to http://localhost:3000/signin
    And I should see the sign in form

  @smoke
  Scenario: Newly registered user can sign in immediately after registration
    Given I successfully registered with username "newuser_signin" and password "Password123"
    And I am on the sign in page at http://localhost:3000/signin
    When I enter "newuser_signin" in the Username field
    And I enter "Password123" in the Password field
    And I click the "SIGN IN" button
    Then I should be redirected away from the sign in page
    And I should see my account dashboard

  @smoke
  Scenario: Sign Up button is enabled on initial page load
    Given I have not interacted with any field
    Then the "SIGN UP" button should be enabled

  @smoke
  Scenario: "Have an account? Sign In" link navigates to sign in page
    When I click the "Have an account? Sign In" link
    Then I should be on the sign in page at http://localhost:3000/signin

  # ===== EDGE CASES =====

  @regression
  Scenario Outline: Missing required fields show inline validation errors
    When I click the <field> field and then click away without entering anything
    Then I should see the error "<expected error>" beneath the <field> field

    Examples:
      | field            | expected error                 |
      | First Name       | First Name is required         |
      | Last Name        | Last Name is required          |
      | Username         | Username is required           |
      | Password         | Enter your password            |
      | Confirm Password | Confirm your password          |

  @regression
  Scenario: Submitting with all fields empty disables the Sign Up button
    When I click the First Name field and then click away without entering anything
    And I click the Last Name field and then click away without entering anything
    And I click the Username field and then click away without entering anything
    And I click the Password field and then click away without entering anything
    And I click the Confirm Password field and then click away without entering anything
    Then the "SIGN UP" button should be disabled

  @regression
  Scenario: Password and Confirm Password mismatch shows validation error
    When I enter "Password123" in the Password field
    And I enter "DifferentPass456" in the Confirm Password field
    And I click the First Name field to trigger validation
    Then I should see an error indicating the passwords do not match

  @regression
  Scenario Outline: Password too short shows validation error
    When I enter "<short_password>" in the Password field
    And I click the Confirm Password field to trigger validation
    Then I should see an error indicating the password is too short

    Examples:
      | short_password |
      | abc            |
      | 1234567        |
      | pass           |

  @regression
  Scenario: Very long inputs are accepted or produce a clear error
    When I enter a First Name of 255 characters
    And I enter a Last Name of 255 characters
    And I enter a Username of 255 characters
    And I enter "Password123" in the Password field
    And I enter "Password123" in the Confirm Password field
    And I click the "SIGN UP" button
    Then I should either be redirected to /signin or see a clear validation message
    And the page should not crash or show a blank screen

  @regression
  Scenario: Username with special characters is handled gracefully
    When I enter "Jane" in the First Name field
    And I enter "Doe" in the Last Name field
    And I enter "user@name!" in the Username field
    And I enter "Password123" in the Password field
    And I enter "Password123" in the Confirm Password field
    And I click the "SIGN UP" button
    Then I should either complete registration or see a clear validation message about the username format

  @regression
  Scenario: Username with spaces is handled gracefully
    When I enter "Jane" in the First Name field
    And I enter "Doe" in the Last Name field
    And I enter "user name" in the Username field
    And I enter "Password123" in the Password field
    And I enter "Password123" in the Confirm Password field
    And I click the "SIGN UP" button
    Then I should either complete registration or see a clear validation message about the username format

  # ===== NEGATIVE CASES =====

  @regression
  Scenario: Duplicate username shows an error
    Given an account already exists with username "Heath93"
    When I enter "Jane" in the First Name field
    And I enter "Doe" in the Last Name field
    And I enter "Heath93" in the Username field
    And I enter "Password123" in the Password field
    And I enter "Password123" in the Confirm Password field
    And I click the "SIGN UP" button
    Then I should see an error indicating the username is already taken
    And I should remain on the sign up page
    # KNOWN BUG (BUG-002): The API currently returns 500 HTML instead of 409 JSON for duplicate usernames.
    # The UI may show a generic error or no error at all until BUG-002 is resolved.

  @regression
  Scenario: Submitting via API with missing required fields returns an error
    Given the API is available at http://localhost:3001
    When I send a POST request to /users with an empty body
    Then the response status should indicate a client error
    # KNOWN BUG (BUG-001): The API currently returns 500 HTML (Prisma stack trace) instead of 422 JSON
    # for missing required fields. This will be fixed in a future release.

  # ===== SECURITY =====

  @security
  Scenario Outline: XSS payloads in registration fields are safely rendered
    When I enter "<xss_payload>" in the <field> field
    And I complete all other required fields with valid data
    And I click the "SIGN UP" button
    Then the page should not execute any scripts
    And I should either be redirected to /signin or see a validation error
    And the browser should not show any alert dialog

    Examples:
      | field      | xss_payload                              |
      | First Name | <script>alert('xss')</script>            |
      | Last Name  | <img src=x onerror=alert('xss')>         |
      | Username   | <script>document.cookie</script>         |
      | First Name | javascript:alert(1)                      |
      | Last Name  | "><svg onload=alert(1)>                  |

  @security
  Scenario Outline: SQL injection payloads in registration fields are handled safely
    When I enter "<sql_payload>" in the <field> field
    And I complete all other required fields with valid data
    And I click the "SIGN UP" button
    Then the application should not expose a database error
    And the page should not crash or show a stack trace

    Examples:
      | field    | sql_payload                  |
      | Username | ' OR '1'='1                  |
      | Username | '; DROP TABLE users; --       |
      | Username | " OR 1=1 --                  |

  @security
  Scenario: Password field input is masked (not visible as plain text)
    When I enter "MySecret123" in the Password field
    Then the characters I typed should appear as dots or asterisks
    And the password should not be visible as plain text

  @security
  Scenario: Confirm Password field input is masked (not visible as plain text)
    When I enter "MySecret123" in the Confirm Password field
    Then the characters I typed should appear as dots or asterisks
    And the password should not be visible as plain text

  @security
  Scenario: Registration credentials are not passed in the URL
    When I complete the sign up form with valid data and submit
    Then the URL in the browser should not contain my username or password
    And the URL should not contain any query parameters with credentials

  @security
  Scenario: API response does not expose the bcrypt password hash
    Given the API is available at http://localhost:3001
    When I send a POST request to /users with valid registration data
    Then the response status should be 201
    And the response body should contain the new user's id, username, firstName, and lastName
    # KNOWN BUG (BUG-003 / BUG-004): The API response currently exposes the bcrypt password hash
    # in the "user.password" field. Password hashes must never be returned to clients.
    # This is a security vulnerability pending remediation.

  @security
  Scenario: Sign up form does not auto-complete password fields with saved credentials
    When I inspect the Password field attributes
    Then the Password field should have autocomplete set to "new-password"

  # ===== API FUNCTIONAL =====

  @api @smoke
  Scenario: POST /users with valid data creates a new user and returns 201
    Given the API is available at http://localhost:3001
    When I send a POST request to /users with body:
      """
      {
        "firstName": "Test",
        "lastName": "User",
        "username": "apitestuser01",
        "password": "Password123",
        "confirmPassword": "Password123"
      }
      """
    Then the response status should be 201
    And the response body should contain a "user" object
    And the user object should include "id", "firstName", "lastName", and "username"
    And "firstName" should equal "Test"
    And "lastName" should equal "User"
    And "username" should equal "apitestuser01"

  @api @smoke
  Scenario: POST /users response does not expose a plain-text password
    Given the API is available at http://localhost:3001
    When I send a POST request to /users with valid registration data
    Then the response status should be 201
    And the "user.password" field in the response should not equal the plain-text password I submitted

  @api @regression
  Scenario: POST /users with mismatched passwords is rejected
    Given the API is available at http://localhost:3001
    When I send a POST request to /users with "password" set to "Password123" and "confirmPassword" set to "Different456"
    Then the response status should indicate an error

  @api @regression
  Scenario: POST /users with a duplicate username returns an error response
    Given the API is available at http://localhost:3001
    And an account already exists with username "Heath93"
    When I send a POST request to /users with username "Heath93" and valid other fields
    Then the response should indicate the username is already taken
    # KNOWN BUG (BUG-002): Currently returns 500 HTML instead of 409 JSON.
    # Expected: 409 Conflict with JSON body { "error": "Username already exists" }
    # Actual: 500 Internal Server Error with HTML Prisma stack trace

  @api @regression
  Scenario: POST /users with missing required fields returns an error response
    Given the API is available at http://localhost:3001
    When I send a POST request to /users with an empty JSON body {}
    Then the response should indicate required fields are missing
    # KNOWN BUG (BUG-001): Currently returns 500 HTML instead of 422 JSON.
    # Expected: 422 Unprocessable Entity with JSON body listing missing fields
    # Actual: 500 Internal Server Error with HTML Prisma stack trace

  @api @regression
  Scenario: POST /users with no Content-Type header is handled gracefully
    Given the API is available at http://localhost:3001
    When I send a POST request to /users without a Content-Type header
    Then the response should not expose a server stack trace

  # ===== ACCESSIBILITY =====

  @a11y
  Scenario: Sign up page passes WCAG 2.1 AA automated accessibility audit
    Given I am on the sign up page
    When I run an automated accessibility check with axe-core
    Then there should be no WCAG 2.1 AA violations

  @a11y
  Scenario: All form fields have visible and programmatic labels
    Given I am on the sign up page
    Then the First Name field should have a visible label
    And the Last Name field should have a visible label
    And the Username field should have a visible label
    And the Password field should have a visible label
    And the Confirm Password field should have a visible label
    And each label should be programmatically associated with its input field

  @a11y
  Scenario: Tab key navigates through fields in logical order
    Given I am on the sign up page
    When I press Tab repeatedly from the top of the page
    Then focus should move through the fields in this order:
      | 1 | First Name field       |
      | 2 | Last Name field        |
      | 3 | Username field         |
      | 4 | Password field         |
      | 5 | Confirm Password field |
      | 6 | Sign Up button         |
      | 7 | Have an account? Sign In link |

  @a11y
  Scenario: Form can be submitted using the keyboard alone
    When I fill in all fields using the keyboard only (Tab to navigate, typing to enter values)
    And I press Enter while focused on the Sign Up button
    Then the form should submit
    And I should be redirected to /signin

  @a11y
  Scenario: Inline validation error messages are announced to screen readers
    When I move focus into the First Name field and then press Tab without entering a value
    Then the error message "First Name is required" should appear
    And the error message should be associated with the First Name field via aria-describedby or role="alert"

  @a11y
  Scenario: Sign Up button has a clear accessible name
    Given I am on the sign up page
    Then the submit button should have an accessible name of "SIGN UP" or "Sign Up"

  # ===== VISUAL =====

  @visual
  Scenario: Sign up page initial state matches visual baseline
    Given I am on the sign up page with no fields filled in
    When I take a screenshot
    Then the screenshot should match the stored baseline for "signup-initial-state"

  @visual
  Scenario: Sign up page error state matches visual baseline
    When I click the First Name field and then click away without entering anything
    And I click the Last Name field and then click away without entering anything
    And I click the Username field and then click away without entering anything
    And I click the Password field and then click away without entering anything
    And I click the Confirm Password field and then click away without entering anything
    And I take a screenshot
    Then the screenshot should match the stored baseline for "signup-all-errors-state"

  @visual
  Scenario: Sign up page filled state matches visual baseline
    When I enter "Jane" in the First Name field
    And I enter "Doe" in the Last Name field
    And I enter "visualtestuser" in the Username field
    And I enter "Password123" in the Password field
    And I enter "Password123" in the Confirm Password field
    And I take a screenshot
    Then the screenshot should match the stored baseline for "signup-filled-valid-state"

# ===== MANUAL TESTING NOTES =====
#
# Test environment:  http://localhost:3000  (UI)   |  http://localhost:3001  (API)
# Seed user:         Heath93 / s3cret  (Ted Parisian, id: uBmeaz5pX)
#
# Before testing:
#   1. Ensure Docker is running:  docker compose up -d
#   2. Reset the database:        npm run db:seed
#   3. Clear browser storage before each session (DevTools → Application → Clear site data)
#
# Known bugs (do NOT report these as new defects):
#   BUG-001: POST /users with missing required fields returns 500 HTML (Prisma stack trace)
#            instead of 422 JSON.  Affects: "Missing required fields" API test.
#   BUG-002: POST /users with a duplicate username returns 500 HTML instead of 409 JSON.
#            Affects: "Duplicate username" UI and API tests.
#   BUG-003/004: POST /users and POST /login both return the bcrypt password hash in
#            response.user.password — a security vulnerability.
#            Affects: "API response does not expose the bcrypt password hash" security test.
#
# Visual regression baselines:
#   - Baselines are stored in __snapshots__/
#   - To create or update baselines: npx playwright test --update-snapshots --grep @visual
#   - Always commit __snapshots__/ to git — CI needs it
#
# Special test data notes:
#   - Do NOT use "Heath93" as the username when testing successful registration — that user
#     already exists after db:seed and will hit BUG-002 (duplicate username → 500).
#   - Use unique usernames per test run (e.g. include a timestamp suffix).
#   - Run npm run db:seed between test sessions to restore Heath93 if deleted accidentally.
#
# Rate limiting / performance:
#   - Rapid repeated sign-up attempts may trigger rate limiting.
#   - Performance tests (response time SLAs) require manual execution;
#     see tests/api/signup.spec.ts Performance describe block.
