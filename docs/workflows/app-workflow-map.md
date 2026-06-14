# RWA Workflow Map

Generated: 2026-06-14
Seed user: Heath93 / s3cret (Theodore Parisian — firstName was changed to Theodore from Ted during settings-update workflow; after db:seed it is "Ted")
Seed user ID: uBmeaz5pX
App UI: http://localhost:3000
App API: http://localhost:3001

---

## Seed Users (after db:seed)

| ID          | Full Name        | Username         | Email                    | Phone        | Balance        |
| ----------- | ---------------- | ---------------- | ------------------------ | ------------ | -------------- |
| uBmeaz5pX   | Ted Parisian     | Heath93          | Santos.Runte65@gmail.com | 398-225-9900 | 150953 (cents) |
| GjWovtg2hr  | Kristian Bradtke | Arvilla_Hegmann  | Skyla.Stamm@yahoo.com    | 410-786-2112 | 93026          |
| \_XblMqbuoP | Darrel Ortiz     | Dina20           | Marielle_Wiza@yahoo.com  | 887-309-1593 | 158880         |
| M1ty1gR8B3  | Ruthie Prosacco  | Reyes.Osinski    | Norma27@gmail.com        | 467-316-5352 | —              |
| WHjJ4qR2R2  | Lia Rosenbaum    | Judah_Dietrich50 | Nigel54@hotmail.com      | 990-583-8419 | 49474          |

Seed bank account (Heath93): id=pgl34JtnfhX, bank="Waters, King and O'Reilly Bank", routing=996645387, account=7774132232

---

## Routes

| Route             | Title                  | Auth Required | Primary Component             | Section Label         |
| ----------------- | ---------------------- | ------------- | ----------------------------- | --------------------- |
| /                 | Cypress Real World App | Yes           | Public transaction feed       | "Public"              |
| /contacts         | Cypress Real World App | Yes           | Friends transaction feed      | "Contacts"            |
| /personal         | Cypress Real World App | Yes           | Personal transaction feed     | "Personal"            |
| /transaction/new  | Cypress Real World App | Yes           | 3-step new transaction wizard | —                     |
| /transaction/{id} | Cypress Real World App | Yes           | Transaction detail            | "Transaction Detail"  |
| /user/settings    | Cypress Real World App | Yes           | User settings form            | "User Settings"       |
| /bankaccounts     | Cypress Real World App | Yes           | Bank accounts list            | "Bank Accounts"       |
| /bankaccounts/new | Cypress Real World App | Yes           | Create bank account form      | "Create Bank Account" |
| /notifications    | Cypress Real World App | Yes           | Notifications list            | "Notifications"       |
| /signin           | Cypress Real World App | No            | Sign in form                  | "Sign in"             |
| /signup           | Cypress Real World App | No            | Sign up form                  | "Sign Up"             |

**Authentication mechanism:** XState machine (`authState` in localStorage). Value is "authorized" when logged in, "unauthorized" when not. Unauthenticated access to any protected route redirects to `/signin`.

---

## API Endpoints Discovered

### Authentication

| Method | URL        | Auth | Request Body                                          | Response Shape                                            |
| ------ | ---------- | ---- | ----------------------------------------------------- | --------------------------------------------------------- |
| POST   | /login     | No   | `{"username":"...","password":"...","remember":true}` | `{"user":{...}}` (200) or plain text "Unauthorized" (401) |
| POST   | /logout    | Yes  | —                                                     | 302 redirect to /signin                                   |
| GET    | /checkAuth | Yes  | —                                                     | `{"user":{...}}` or `{"error":"User is unauthorized"}`    |

**Cookie notes:**

- Session login (no `remember`): `connect.sid` cookie with no `Expires` — session cookie
- Remember me (`remember: true`): `connect.sid` cookie with `Expires` header 30 days out (no `Max-Age`)
- `POST /login` response always exposes `user.password` (bcrypt hash) — **BUG-003**

### Transactions

| Method | URL                    | Auth | Request Body                                                                                                                                                                 | Response Shape                                                                                                     |
| ------ | ---------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET    | /transactions/public   | Yes  | Query: `page`, `limit`, `amountMin`, `amountMax`                                                                                                                             | `{"pageData":{page,limit,hasNextPages,totalPages},"results":[...]}`                                                |
| GET    | /transactions/contacts | Yes  | Query: `page`, `limit`, `amountMin`, `amountMax`                                                                                                                             | same as public                                                                                                     |
| GET    | /transactions          | Yes  | Query: `page`, `limit`, `status`, `requestStatus`, `amountMin`, `amountMax`                                                                                                  | same as public                                                                                                     |
| GET    | /transactions/{id}     | Yes  | —                                                                                                                                                                            | `{"transaction":{...likes:[],comments:[],...}}`                                                                    |
| POST   | /transactions          | Yes  | `{"source":"bankAccountId","amount":centValue,"description":"...","receiverId":"...","transactionType":"payment"\|"request","privacyLevel":"public"\|"private"\|"contacts"}` | `{"transaction":{id,uuid,source,amount,description,privacyLevel,receiverId,senderId,status,createdAt,modifiedAt}}` |
| PATCH  | /transactions/{id}     | Yes  | `{"id":"...","requestStatus":"accepted"\|"rejected"}`                                                                                                                        | 204 No Content                                                                                                     |

**Transaction amount:** stored in cents (integer). UI displays as dollars with 2 decimals.

**Transaction fields:**

- `id` — unique string ID (e.g. `Ec6hHyL6SC2F`)
- `uuid` — UUID v4
- `source` — bank account ID of sender
- `amount` — integer cents
- `description` — string
- `privacyLevel` — "public" | "private" | "contacts"
- `receiverId` — user ID
- `senderId` — user ID
- `balanceAtCompletion` — integer cents (only on seeded transactions)
- `status` — "pending" | "complete"
- `requestStatus` — "" (payment) | "pending" | "accepted" | "rejected"
- `requestResolvedAt` — ISO string or ""
- `createdAt` / `modifiedAt` — ISO strings
- `receiverName`, `senderName`, `receiverAvatar`, `senderAvatar` — joined fields
- `likes` — array of like objects `{id,uuid,userId,transactionId,createdAt,modifiedAt}`
- `comments` — array of comment objects

**BUG-HOME-001:** `GET /transactions/public?dateStart=...&dateEnd=...` returns **500** (server crash). Same bug affects `/transactions/contacts?dateStart=...` and `/transactions?dateStart=...`. Amount filter (`amountMin`/`amountMax`) works correctly.

### Likes

| Method | URL                    | Auth | Request Body | Response Shape         |
| ------ | ---------------------- | ---- | ------------ | ---------------------- |
| POST   | /likes/{transactionId} | Yes  | —            | "OK" (plain text, 200) |

**Note:** Each POST creates a new like entry. Calling POST multiple times from the same user creates duplicate likes (no deduplication). The UI like button prevents double-clicking, but the API does not enforce uniqueness.

### Comments

| Method | URL                       | Auth | Request Body        | Response Shape         |
| ------ | ------------------------- | ---- | ------------------- | ---------------------- |
| POST   | /comments/{transactionId} | Yes  | `{"content":"..."}` | "OK" (plain text, 200) |

### Users

| Method | URL                     | Auth | Request Body                                                                                                    | Response Shape                                                                                                                      |
| ------ | ----------------------- | ---- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /users                  | Yes  | —                                                                                                               | `{"results":[{id,uuid,firstName,lastName,username,email,phoneNumber,balance,avatar,defaultPrivacyLevel,createdAt,modifiedAt},...]}` |
| GET    | /users/search?q={query} | Yes  | —                                                                                                               | `{"results":[...]}`                                                                                                                 |
| GET    | /users/{id}             | Yes  | —                                                                                                               | `{"user":{...}}`                                                                                                                    |
| PATCH  | /users/{id}             | Yes  | `{"id":"...","firstName":"...","lastName":"...","email":"...","phoneNumber":"...","defaultPrivacyLevel":"..."}` | 204 No Content                                                                                                                      |
| POST   | /users                  | No   | `{"firstName":"...","lastName":"...","username":"...","password":"...","confirmPassword":"..."}`                | `{"user":{...}}`                                                                                                                    |

**BUG-003:** `POST /login` response includes `user.password` (bcrypt hash).
**BUG-004:** `POST /users` response includes `user.password` (bcrypt hash).
**BUG-001:** `POST /users` with missing required fields returns 500 HTML (Prisma stack trace), not 422.
**BUG-002:** `POST /users` with duplicate username returns 500 HTML, not 409.

User search (`GET /users/search?q=`) is used by the new transaction form step 1 when typing in the search box.

### Notifications

| Method | URL                 | Auth | Request Body                 | Response Shape                                                                                                         |
| ------ | ------------------- | ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | /notifications      | Yes  | —                            | `{"results":[{id,uuid,userId,transactionId,likeId?,commentId?,status?,isRead,userFullName,createdAt,modifiedAt},...]}` |
| PATCH  | /notifications/{id} | Yes  | `{"id":"...","isRead":true}` | 204 No Content                                                                                                         |

**Notification types** (determined by which field is present):

- Like notification: has `likeId` field
- Comment notification: has `commentId` field
- Payment/request notification: has `status` field ("requested" | "received")

### Bank Accounts (GraphQL via /graphql)

| Method | URL      | Operation         | Variables                                       | Response                                                                                                              |
| ------ | -------- | ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| POST   | /graphql | ListBankAccount   | —                                               | `{"data":{"listBankAccount":[{id,uuid,userId,bankName,accountNumber,routingNumber,isDeleted,createdAt,modifiedAt}]}}` |
| POST   | /graphql | CreateBankAccount | `{userId,bankName,accountNumber,routingNumber}` | `{"data":{"createBankAccount":{...}}}`                                                                                |
| POST   | /graphql | DeleteBankAccount | `{id}`                                          | `{"data":{"deleteBankAccount":null}}`                                                                                 |

**GraphQL query bodies:**

CreateBankAccount:

```json
{
  "operationName": "CreateBankAccount",
  "query": "mutation CreateBankAccount($bankName: String!, $accountNumber: String!, $routingNumber: String!) { createBankAccount(bankName: $bankName accountNumber: $accountNumber routingNumber: $routingNumber) { id uuid userId bankName accountNumber routingNumber isDeleted createdAt } }",
  "variables": {
    "userId": "uBmeaz5pX",
    "bankName": "...",
    "accountNumber": "...",
    "routingNumber": "..."
  }
}
```

DeleteBankAccount:

```json
{
  "operationName": "DeleteBankAccount",
  "query": "mutation DeleteBankAccount($id: ID!) { deleteBankAccount(id: $id) }",
  "variables": {"id": "..."}
}
```

GraphQL only exposes `createBankAccount` and `deleteBankAccount` mutations. All other mutations (transactions, likes, comments, etc.) use REST endpoints.

---

## Navigation Graph

```
/signin → / (after successful login)
/signin → /signup (click "Don't have an account? Sign Up")
/signup → /signin (implied after registration)

/ → /contacts (click "Friends" tab)
/ → /personal (click "Mine" tab)
/ → /transaction/new (click "New" button in top nav)
/ → /transaction/{id} (click any transaction list item)
/ → /notifications (click notification bell)
/ → /user/settings (click "My Account" in sidenav)
/ → /bankaccounts (click "Bank Accounts" in sidenav)
/ → /signin (click "Logout" in sidenav, or navigate while unauthenticated)

/contacts → / (click "Everyone" tab)
/contacts → /personal (click "Mine" tab)
/contacts → /transaction/{id} (click transaction item)

/personal → / (click "Everyone" tab)
/personal → /contacts (click "Friends" tab)
/personal → /transaction/{id} (click transaction item)

/transaction/new → / (click "Return To Transactions" after success)
/transaction/new → /transaction/new (click "Create Another Transaction" after success — resets wizard)
/transaction/new (step 1) → /transaction/new (step 2) (click a user from the list)
/transaction/new (step 2) → /transaction/new (step 3 success) (click "Pay" or "Request")

/transaction/{id} → / (browser back or sidenav Home)

/bankaccounts → /bankaccounts/new (click "Create")
/bankaccounts/new → /bankaccounts (submit form)

/notifications → /transaction/{id} (click notification item — navigates to linked transaction)
```

---

## Data-test Attributes by Page

### Global (present on all authenticated pages)

| Selector                                    | Tag    | Description                                              |
| ------------------------------------------- | ------ | -------------------------------------------------------- |
| `[data-test="sidenav-toggle"]`              | BUTTON | Hamburger menu toggle for mobile drawer                  |
| `[data-test="drawer-icon"]`                 | SVG    | Drawer icon inside toggle                                |
| `[data-test="app-name-logo"]`               | H1     | App logo/name heading                                    |
| `[data-test="nav-top-new-transaction"]`     | A      | "New" button in top nav bar, links to /transaction/new   |
| `[data-test="nav-top-notifications-link"]`  | A      | Notification bell link, links to /notifications          |
| `[data-test="nav-top-notifications-count"]` | SPAN   | Notification count badge (number inside bell)            |
| `[data-test="sidenav"]`                     | DIV    | Full sidebar container                                   |
| `[data-test="sidenav-user-full-name"]`      | H6     | Current user's display name in sidebar (e.g. "Ted P")    |
| `[data-test="sidenav-username"]`            | H6     | Current user's username with @ (e.g. "@Heath93")         |
| `[data-test="sidenav-user-balance"]`        | H6     | Current user's balance (e.g. "$1,509.53")                |
| `[data-test="sidenav-home"]`                | A      | "Home" link in sidebar, links to /                       |
| `[data-test="sidenav-user-settings"]`       | A      | "My Account" link in sidebar, links to /user/settings    |
| `[data-test="sidenav-bankaccounts"]`        | A      | "Bank Accounts" link in sidebar, links to /bankaccounts  |
| `[data-test="sidenav-notifications"]`       | A      | "Notifications" link in sidebar, links to /notifications |
| `[data-test="sidenav-signout"]`             | DIV    | "Logout" button container in sidebar                     |
| `[data-test="main"]`                        | MAIN   | Main content area                                        |

### / (Public Feed), /contacts (Friends Feed), /personal (Personal Feed)

All three share the same structure. The section label text differs ("Public", "Contacts", "Personal").

| Selector                                                    | Tag    | Description                                                       |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `[data-test="nav-transaction-tabs"]`                        | DIV    | Container for the three feed tabs                                 |
| `[data-test="nav-public-tab"]`                              | A      | "Everyone" tab, links to /                                        |
| `[data-test="nav-contacts-tab"]`                            | A      | "Friends" tab, links to /contacts                                 |
| `[data-test="nav-personal-tab"]`                            | A      | "Mine" tab, links to /personal                                    |
| `[data-test="transaction-list-filter-date-range-button"]`   | DIV    | Date filter button ("Date: ALL")                                  |
| `[data-test="transaction-list-filter-amount-range-button"]` | DIV    | Amount filter button ("Amount: $0 - $1,000")                      |
| `[data-test="transaction-list-filter-date-range"]`          | DIV    | Date range calendar popup (visible after clicking date button)    |
| `[data-test="transaction-list-filter-amount-range"]`        | DIV    | Amount range slider popup (visible after clicking amount button)  |
| `[data-test="transaction-list-filter-amount-range-text"]`   | P      | Text showing current range inside popup                           |
| `[data-test="transaction-list-filter-amount-clear-button"]` | BUTTON | "Clear" button inside amount filter popup                         |
| `[data-test="transaction-list-filter-amount-range-slider"]` | SPAN   | MUI Slider element for amount range                               |
| `[data-test="transaction-list"]`                            | DIV    | Container for transaction items                                   |
| `[data-test="transaction-item-{id}"]`                       | LI     | Individual transaction list item                                  |
| `[data-test="transaction-sender-{id}"]`                     | SPAN   | Sender name in list item                                          |
| `[data-test="transaction-action-{id}"]`                     | SPAN   | Action word ("paid", "requested", "charged")                      |
| `[data-test="transaction-receiver-{id}"]`                   | SPAN   | Receiver name in list item                                        |
| `[data-test="transaction-like-count"]`                      | P      | Like count (not unique per transaction in list — no id suffix)    |
| `[data-test="transaction-comment-count"]`                   | P      | Comment count (not unique per transaction in list — no id suffix) |
| `[data-test="transaction-amount-{id}"]`                     | SPAN   | Amount (e.g. "-$307.99" or "+$42.36")                             |

**Note on like/comment counts in list:** `data-test="transaction-like-count"` and `data-test="transaction-comment-count"` have NO transaction ID suffix in list views. On the detail page, the like count uses `data-test="transaction-like-count-{id}"`. To associate counts with a transaction in list view, use the parent `li[data-test="transaction-item-{id}"]` as context.

### /transaction/{id} (Transaction Detail)

| Selector                                        | Tag    | Description                                                                       |
| ----------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `[data-test="transaction-detail-header"]`       | H2     | "Transaction Detail" heading                                                      |
| `[data-test="transaction-item-{id}"]`           | DIV    | Transaction card (note: DIV on detail, LI in list)                                |
| `[data-test="transaction-receiver-avatar"]`     | DIV    | Receiver avatar image wrapper                                                     |
| `[data-test="transaction-sender-avatar"]`       | DIV    | Sender avatar image wrapper                                                       |
| `[data-test="transaction-sender-{id}"]`         | SPAN   | Sender name                                                                       |
| `[data-test="transaction-action-{id}"]`         | SPAN   | Action word                                                                       |
| `[data-test="transaction-receiver-{id}"]`       | SPAN   | Receiver name                                                                     |
| `[data-test="transaction-description"]`         | P      | Transaction description text                                                      |
| `[data-test="transaction-amount-{id}"]`         | SPAN   | Amount                                                                            |
| `[data-test="transaction-like-count-{id}"]`     | DIV    | Like count (has ID suffix on detail page)                                         |
| `[data-test="transaction-like-button-{id}"]`    | BUTTON | Like button (heart icon)                                                          |
| `[data-test="transaction-comment-input-{id}"]`  | INPUT  | Comment text input (actual INPUT element, id=`transaction-comment-input-{id}`)    |
| `[data-test="transaction-accept-request-{id}"]` | BUTTON | "Accept Request" button (only on pending requests where current user is receiver) |
| `[data-test="transaction-reject-request-{id}"]` | BUTTON | "Reject Request" button (only on pending requests where current user is receiver) |

**Comment display:** Comments appear below the like/comment area. No specific `data-test` attribute on individual rendered comments was observed.

### /transaction/new (New Transaction Wizard)

**Step 1 — Select Contact:**

| Selector                                | Tag   | Description                                        |
| --------------------------------------- | ----- | -------------------------------------------------- |
| `[data-test="user-list-search-input"]`  | INPUT | Search field (actual INPUT, filters the user list) |
| `[data-test="users-list"]`              | UL    | List of users to select from                       |
| `[data-test="user-list-item-{userId}"]` | LI    | Individual user item; click to advance to step 2   |

User list shows: full name, "U: {username}", "E: {email}", "P: {phone}".

**Step 2 — Payment:**

| Selector                                             | Tag    | Description                                                                |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `[data-test="transaction-create-form"]`              | FORM   | Payment form container                                                     |
| `[data-test="transaction-create-amount-input"]`      | DIV    | MUI wrapper — actual input has `id="amount"`                               |
| `[data-test="transaction-create-description-input"]` | DIV    | MUI wrapper — actual input has `id="transaction-create-description-input"` |
| `[data-test="transaction-create-submit-request"]`    | BUTTON | "Request" button                                                           |
| `[data-test="transaction-create-submit-payment"]`    | BUTTON | "Pay" button                                                               |

Amount input formats with `$` prefix automatically (e.g. "$50" for value 50).

**Step 3 — Complete (success screen):**

| Selector                                                   | Tag    | Description                                         |
| ---------------------------------------------------------- | ------ | --------------------------------------------------- |
| `[data-test="new-transaction-return-to-transactions"]`     | A      | "Return To Transactions" link to /                  |
| `[data-test="new-transaction-create-another-transaction"]` | BUTTON | "Create Another Transaction" button (resets wizard) |

Success message format: `"Paid $X.XX for {description}"` or `"Requested $X.XX for {description}"` with selected user name shown.

### /user/settings (User Settings)

| Selector                                        | Tag    | Description                                       |
| ----------------------------------------------- | ------ | ------------------------------------------------- |
| `[data-test="user-settings-form"]`              | FORM   | Settings form                                     |
| `[data-test="user-settings-firstName-input"]`   | INPUT  | First name field (actual INPUT — not MUI wrapper) |
| `[data-test="user-settings-lastName-input"]`    | INPUT  | Last name field (actual INPUT)                    |
| `[data-test="user-settings-email-input"]`       | INPUT  | Email field (actual INPUT)                        |
| `[data-test="user-settings-phoneNumber-input"]` | INPUT  | Phone number field (actual INPUT)                 |
| `[data-test="user-settings-submit"]`            | BUTTON | "Save" button                                     |

**Note:** Unlike most other forms, user-settings inputs are actual `INPUT` elements directly, not MUI TextField wrappers. `getByTestId` works directly.

### /bankaccounts (Bank Accounts List)

| Selector                                   | Tag    | Description                                                      |
| ------------------------------------------ | ------ | ---------------------------------------------------------------- |
| `[data-test="bankaccount-new"]`            | A      | "Create" link to /bankaccounts/new                               |
| `[data-test="bankaccount-list"]`           | UL     | List of bank accounts                                            |
| `[data-test="bankaccount-list-item-{id}"]` | LI     | Individual bank account list item                                |
| `[data-test="bankaccount-delete"]`         | BUTTON | "Delete" button (NOT unique per account — use parent LI context) |

Deleted accounts display as "{bank name} (Deleted)" and remain in the list (soft delete, `isDeleted: true`).

### /bankaccounts/new (Create Bank Account)

| Selector                                        | Tag    | Description                                                           |
| ----------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `[data-test="bankaccount-form"]`                | FORM   | Bank account form                                                     |
| `[data-test="bankaccount-bankName-input"]`      | DIV    | MUI wrapper — actual input has `id="bankaccount-bankName-input"`      |
| `[data-test="bankaccount-routingNumber-input"]` | DIV    | MUI wrapper — actual input has `id="bankaccount-routingNumber-input"` |
| `[data-test="bankaccount-accountNumber-input"]` | DIV    | MUI wrapper — actual input has `id="bankaccount-accountNumber-input"` |
| `[data-test="bankaccount-submit"]`              | BUTTON | "Save" button                                                         |

Routing number must be 9 digits. Account number must be 9-12 digits (validated client-side).

### /notifications (Notifications)

| Selector                                    | Tag    | Description                                                            |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `[data-test="notifications-list"]`          | UL     | List of notifications                                                  |
| `[data-test="notification-list-item-{id}"]` | LI     | Individual notification item                                           |
| `[data-test="notification-mark-read-{id}"]` | BUTTON | "Dismiss" button — marks notification as read and removes it from list |

Notification text formats:

- Like: "{Name} liked a transaction."
- Comment: "{Name} commented on a transaction."
- Requested payment: "{Name} requested payment."
- Received payment: "{Name} received payment."

After dismissing, the notification disappears from the list. The badge count in the top nav decrements.

### /signin (Sign In)

| Selector                           | Tag    | Description                                                                          |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `[data-test="signin-username"]`    | DIV    | MUI wrapper — actual input has `id="username"`                                       |
| `[data-test="signin-password"]`    | DIV    | MUI wrapper — actual input has `id="password"`                                       |
| `[data-test="signin-remember-me"]` | SPAN   | MUI wrapper — checkbox has `[data-test="signin-remember-me"] input[type="checkbox"]` |
| `[data-test="signin-submit"]`      | BUTTON | "Sign In" button                                                                     |
| `[data-test="signup"]`             | A      | "Don't have an account? Sign Up" link to /signup                                     |

**Known bugs:**

- Tab focus order is broken — Username is NOT first-focused element (BUG-007)
- axe-core `link-name` violations — icon-only links have no accessible name (BUG-006)
- Form submit button starts ENABLED on page load (Formik `isValid` defaults to true before validation runs)
- Sign Up link DOM detachment: hovering it can trigger Formik onBlur re-render, detaching the link before click; use `page.goto('/signup')` instead of clicking the link

### /signup (Sign Up)

| Selector                               | Tag    | Description                                           |
| -------------------------------------- | ------ | ----------------------------------------------------- |
| `[data-test="signup-title"]`           | H1     | "Sign Up" heading                                     |
| `[data-test="signup-first-name"]`      | DIV    | MUI wrapper — actual input has `id="firstName"`       |
| `[data-test="signup-last-name"]`       | DIV    | MUI wrapper — actual input has `id="lastName"`        |
| `[data-test="signup-username"]`        | DIV    | MUI wrapper — actual input has `id="username"`        |
| `[data-test="signup-password"]`        | DIV    | MUI wrapper — actual input has `id="password"`        |
| `[data-test="signup-confirmPassword"]` | DIV    | MUI wrapper — actual input has `id="confirmPassword"` |
| `[data-test="signup-submit"]`          | BUTTON | "Sign Up" button                                      |

---

## Workflows

### Workflow 1: Sign In

**Entry point:** /signin (navigate directly or redirect from any protected page)
**Steps:**

1. Fill `#username` with username
2. Fill `#password` with password
3. (Optional) Click `[data-test="signin-remember-me"] input[type="checkbox"]` for persistent session
4. Click/submit `[data-test="signin-submit"]`
5. XState machine transitions to "authorized" → redirected to /
6. Verify: `localStorage.getItem('authState')` → JSON with `value: "authorized"`

**API calls:**

- POST /login `{"username":"...","password":"..."}` → 200 `{"user":{...}}` | 401 plain text "Unauthorized"

**Data-test anchors:** `signin-username` (DIV), `#username` (input), `signin-password` (DIV), `#password` (input), `signin-remember-me` (SPAN), `signin-submit` (BUTTON)

**Important notes:**

- MUI TextField puts `data-test` on the outer DIV, not the `<input>`. Use `#username` and `#password` for `.fill()`.
- Playwright's `locator.click()` may not trigger React's synthetic event handler — use `element.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}))` if the standard click doesn't submit the form.
- After form interaction, the React/XState machine handles the redirect — no manual `waitForURL` needed, but `waitFor` on the transaction list helps confirm landing.

---

### Workflow 2: Sign Out (Logout)

**Entry point:** Any authenticated page (sidenav visible)
**Steps:**

1. Click `[data-test="sidenav-signout"]`
2. App calls POST /logout
3. XState transitions to "unauthorized"
4. Redirect to /signin

**API calls:**

- POST /logout → 302 redirect to /

**Data-test anchors:** `sidenav-signout` (DIV, contains the Logout button)

**Verify:** `window.location.href` → `http://localhost:3000/signin`; `localStorage.authState` value → "unauthorized"

---

### Workflow 3: Sign Up

**Entry point:** /signup
**Steps:**

1. Fill `#firstName`
2. Fill `#lastName`
3. Fill `#username`
4. Fill `#password`
5. Fill `#confirmPassword`
6. Click `[data-test="signup-submit"]`
7. Redirect to /signin on success

**API calls:**

- POST /users `{"firstName":"...","lastName":"...","username":"...","password":"...","confirmPassword":"..."}` → 200 `{"user":{id,uuid,firstName,lastName,username,password,email,phoneNumber,balance,avatar,defaultPrivacyLevel,createdAt,modifiedAt}}`

**Known bugs:** BUG-001 (missing fields → 500), BUG-002 (duplicate username → 500), BUG-004 (password hash exposed in response)

---

### Workflow 4: Pay a User

**Entry point:** /transaction/new (via "New" top nav or sidenav or direct URL)
**Steps:**

1. **Step 1 — Select Contact:** Click `[data-test="user-list-item-{userId}"]` for the target user. Optionally search via `[data-test="user-list-search-input"]` (actual INPUT) which calls `GET /users/search?q={query}`.
2. **Step 2 — Payment:** Fill `#amount` (displays with `$` prefix), fill `#transaction-create-description-input`.
3. Click `[data-test="transaction-create-submit-payment"]`.
4. **Step 3 — Success:** Displays "Paid $X.XX for {description}" with target user name. Balance updates in sidenav.

**API calls:**

- GET /users (on step 1 load) → user list
- GET /users/search?q={query} (if typing in search) → filtered users
- POST /transactions `{"source":"{bankAccountId}","amount":{cents},"description":"...","receiverId":"{userId}","transactionType":"payment","privacyLevel":"public"}` → 200 `{"transaction":{...}}`

**Data-test anchors:** `user-list-search-input`, `users-list`, `user-list-item-{userId}`, `transaction-create-form`, `transaction-create-amount-input` (DIV), `#amount` (actual input), `transaction-create-description-input` (DIV), `#transaction-create-description-input` (actual input), `transaction-create-submit-payment`, `new-transaction-return-to-transactions`, `new-transaction-create-another-transaction`

**Important:** The Pay button click may require `dispatchEvent(new MouseEvent(...))` to trigger the React handler.

---

### Workflow 5: Request Money from a User

**Entry point:** /transaction/new
**Steps:**

1. Same as Workflow 4 steps 1-2
2. Click `[data-test="transaction-create-submit-request"]` instead of Pay
3. **Step 3 — Success:** Displays "Requested $X.XX for {description}"

**API calls:**

- POST /transactions `{"source":"{bankAccountId}","amount":{cents},"description":"...","receiverId":"{userId}","transactionType":"request","privacyLevel":"public"}` → 200 `{"transaction":{id,...,status:"pending",requestStatus:"pending"}}`

**Data-test anchors:** `transaction-create-submit-request` (BUTTON)

---

### Workflow 6: Like a Transaction

**Entry point:** /transaction/{id}
**Steps:**

1. Navigate to `/transaction/{id}`
2. Click `[data-test="transaction-like-button-{id}"]`
3. Like count `[data-test="transaction-like-count-{id}"]` increments

**API calls:**

- POST /likes/{transactionId} → 200 "OK"
- GET /transactions/{id} → refresh transaction data

**Data-test anchors:** `transaction-like-button-{id}` (BUTTON), `transaction-like-count-{id}` (DIV)

**Note:** The like button is inside a button element. In Playwright, `locator.click()` works. The like count increments in the UI without a page reload. Each POST to `/likes/{id}` always creates a new like (no deduplication) — calling it twice creates 2 likes.

---

### Workflow 7: Comment on a Transaction

**Entry point:** /transaction/{id}
**Steps:**

1. Navigate to `/transaction/{id}`
2. Click `[data-test="transaction-comment-input-{id}"]` (actual INPUT element)
3. Type comment text using `pressSequentially()` (slow type — required for React to register keystrokes)
4. Press Enter
5. Comment appears below the input

**API calls:**

- POST /comments/{transactionId} `{"content":"..."}` → 200 "OK"
- GET /transactions/{id} → refresh to show new comment

**Data-test anchors:** `transaction-comment-input-{id}` (INPUT — `id` attribute also equals `transaction-comment-input-{txId}`)

**Important for Playwright tests:** The comment input requires `pressSequentially()` (character-by-character typing), not `fill()`. The `fill()` method sets the DOM value directly without triggering React's synthetic event handlers, so the component state doesn't update and Enter doesn't submit. Use:

```typescript
await page
  .locator('[data-test="transaction-comment-input-{id}"]')
  .pressSequentially('comment text');
await page.keyboard.press('Enter');
```

**Alternative (API-level):** `POST /comments/{transactionId}` with body `{"content":"..."}` directly.

---

### Workflow 8: Accept a Payment Request

**Entry point:** /transaction/{id} where the current user is the **receiver** of a pending request

**Conditions:** Transaction must have `requestStatus: "pending"` AND `receiverId` must equal the current user's ID.

**Steps:**

1. Navigate to `/transaction/{id}`
2. Click `[data-test="transaction-accept-request-{id}"]`
3. Buttons disappear; transaction action changes from "requested" to "charged"; balance updates

**API calls:**

- PATCH /transactions/{id} `{"id":"...","requestStatus":"accepted"}` → 204 No Content
- GET /transactions/{id} → refresh

**Data-test anchors:** `transaction-accept-request-{id}` (BUTTON)

**Important:** The click requires `dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}))` to trigger the React handler in some environments.

---

### Workflow 9: Reject a Payment Request

**Entry point:** /transaction/{id} where current user is receiver of pending request

**Steps:**

1. Navigate to `/transaction/{id}`
2. Click `[data-test="transaction-reject-request-{id}"]`
3. Buttons disappear

**API calls:**

- PATCH /transactions/{id} `{"id":"...","requestStatus":"rejected"}` → 204 No Content

**Data-test anchors:** `transaction-reject-request-{id}` (BUTTON)

---

### Workflow 10: Add Bank Account

**Entry point:** /bankaccounts/new (via "Create" link on /bankaccounts or sidenav)

**Steps:**

1. Navigate to /bankaccounts/new
2. Fill `#bankaccount-bankName-input`
3. Fill `#bankaccount-routingNumber-input` (9 digits)
4. Fill `#bankaccount-accountNumber-input` (9-12 digits)
5. Click `[data-test="bankaccount-submit"]`
6. Redirect to /bankaccounts; new account appears in list

**API calls:**

- POST /graphql `CreateBankAccount` mutation → new bank account object

**Data-test anchors:** `bankaccount-form` (FORM), `bankaccount-bankName-input` (DIV wrapper), `bankaccount-routingNumber-input` (DIV wrapper), `bankaccount-accountNumber-input` (DIV wrapper), `bankaccount-submit` (BUTTON)

**MUI TextField note:** `data-test` is on the outer DIV, not the `<input>`. Use `#bankaccount-bankName-input`, `#bankaccount-routingNumber-input`, `#bankaccount-accountNumber-input` for the actual inputs.

---

### Workflow 11: Delete Bank Account

**Entry point:** /bankaccounts

**Steps:**

1. Navigate to /bankaccounts
2. Find the target account: `[data-test="bankaccount-list-item-{id}"]`
3. Click the Delete button within it: `[data-test="bankaccount-list-item-{id}"] [data-test="bankaccount-delete"]`
4. Account label changes to "{bank name} (Deleted)" — soft delete, remains in list

**API calls:**

- POST /graphql `DeleteBankAccount` mutation `{id: "..."}` → `{"data":{"deleteBankAccount":null}}`
- POST /graphql `ListBankAccount` → refresh list

**Data-test anchors:** `bankaccount-list` (UL), `bankaccount-list-item-{id}` (LI), `bankaccount-delete` (BUTTON — NOT unique, must scope to parent LI)

---

### Workflow 12: Update User Settings

**Entry point:** /user/settings

**Steps:**

1. Navigate to /user/settings
2. Modify fields: `[data-test="user-settings-firstName-input"]`, `[data-test="user-settings-lastName-input"]`, `[data-test="user-settings-email-input"]`, `[data-test="user-settings-phoneNumber-input"]`
3. Click `[data-test="user-settings-submit"]`
4. Changes reflect in sidenav (name updates immediately)

**API calls:**

- PATCH /users/{id} `{"id":"...","firstName":"...","lastName":"...","email":"...","phoneNumber":"...","defaultPrivacyLevel":"..."}` → 204 No Content
- GET /checkAuth → re-fetch user data

**Data-test anchors:** `user-settings-form` (FORM), `user-settings-firstName-input` (INPUT), `user-settings-lastName-input` (INPUT), `user-settings-email-input` (INPUT), `user-settings-phoneNumber-input` (INPUT), `user-settings-submit` (BUTTON)

**Note:** User settings inputs are actual `INPUT` elements with `data-test` directly on them (unlike most other forms where `data-test` is on the MUI wrapper div). `fill()` works directly.

---

### Workflow 13: Mark Notification as Read

**Entry point:** /notifications

**Steps:**

1. Navigate to /notifications
2. Click `[data-test="notification-mark-read-{id}"]` ("Dismiss" button)
3. Notification disappears from list; badge count decrements

**API calls:**

- PATCH /notifications/{id} `{"id":"...","isRead":true}` → 204 No Content
- GET /notifications → refresh

**Data-test anchors:** `notifications-list` (UL), `notification-list-item-{id}` (LI), `notification-mark-read-{id}` (BUTTON "Dismiss")

---

### Workflow 14: Filter Transactions by Amount

**Entry point:** / or /contacts or /personal

**Steps:**

1. Click `[data-test="transaction-list-filter-amount-range-button"]`
2. Amount range popup appears (`[data-test="transaction-list-filter-amount-range"]`)
3. Adjust `[data-test="transaction-list-filter-amount-range-slider"]` (MUI Slider)
4. Click outside to close; list updates

**API calls:**

- GET /transactions/public?amountMin={n}&amountMax={m} → filtered results

**Data-test anchors:** `transaction-list-filter-amount-range-button`, `transaction-list-filter-amount-range`, `transaction-list-filter-amount-range-text`, `transaction-list-filter-amount-clear-button`, `transaction-list-filter-amount-range-slider`

---

### Workflow 15: Filter Transactions by Date (Broken)

**Entry point:** / or /contacts or /personal

**Steps:**

1. Click `[data-test="transaction-list-filter-date-range-button"]`
2. Calendar popup appears (`[data-test="transaction-list-filter-date-range"]`)
3. Select date range
4. **BUG:** Server crashes with 500

**API calls:**

- GET /transactions/public?dateStart={date}&dateEnd={date} → **500 Internal Server Error** (BUG-HOME-001)
- Same 500 for /transactions/contacts and /transactions

**Data-test anchors:** `transaction-list-filter-date-range-button`, `transaction-list-filter-date-range` (calendar popup)

---

## Known Bugs Discovered

| ID           | Page/Endpoint                                                                             | Description                                                                 | Severity |
| ------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| BUG-HOME-001 | GET /transactions/public?dateStart=...&dateEnd=..., /transactions/contacts, /transactions | Date range filter causes 500 server crash on all three feed endpoints       | High     |
| BUG-001      | POST /users                                                                               | Missing required fields returns 500 HTML (Prisma stack trace), not 422 JSON | Medium   |
| BUG-002      | POST /users                                                                               | Duplicate username returns 500 HTML, not 409 Conflict                       | Medium   |
| BUG-003      | POST /login                                                                               | Response includes `user.password` (bcrypt hash) exposed to client           | High     |
| BUG-004      | POST /users                                                                               | Response includes `user.password` (bcrypt hash) exposed to client           | High     |
| BUG-005      | POST /likes/{id}                                                                          | No deduplication — same user can like same transaction multiple times       | Low      |
| BUG-006      | /signin                                                                                   | axe-core `link-name` violations — icon-only links have no accessible name   | Low      |
| BUG-007      | /signin                                                                                   | Tab focus order broken — username field is not the first focused element    | Low      |

---

## MUI TextField Selector Pattern

The RWA uses Material UI `<TextField>` which puts `data-test` on the **outer wrapper div**, not the `<input>`. This causes `getByTestId('...')` or `locator('[data-test="..."]').fill()` to hang (fills a non-editable div).

**Pattern:** Always use the `<input>`'s `id` attribute to target the actual input:

| Page              | data-test (on DIV)                     | id (on actual INPUT)                    |
| ----------------- | -------------------------------------- | --------------------------------------- |
| /signin           | `signin-username`                      | `#username`                             |
| /signin           | `signin-password`                      | `#password`                             |
| /signup           | `signup-first-name`                    | `#firstName`                            |
| /signup           | `signup-last-name`                     | `#lastName`                             |
| /signup           | `signup-username`                      | `#username`                             |
| /signup           | `signup-password`                      | `#password`                             |
| /signup           | `signup-confirmPassword`               | `#confirmPassword`                      |
| /transaction/new  | `transaction-create-amount-input`      | `#amount`                               |
| /transaction/new  | `transaction-create-description-input` | `#transaction-create-description-input` |
| /bankaccounts/new | `bankaccount-bankName-input`           | `#bankaccount-bankName-input`           |
| /bankaccounts/new | `bankaccount-routingNumber-input`      | `#bankaccount-routingNumber-input`      |
| /bankaccounts/new | `bankaccount-accountNumber-input`      | `#bankaccount-accountNumber-input`      |

**Exceptions (data-test IS on the actual interactive element):**

- `signin-submit` (BUTTON)
- `signup-submit` (BUTTON)
- `signin-remember-me` (SPAN — use `[data-test="signin-remember-me"] input[type="checkbox"]` for the checkbox)
- `signup` (A link)
- `user-settings-firstName-input` (INPUT directly)
- `user-settings-lastName-input` (INPUT directly)
- `user-settings-email-input` (INPUT directly)
- `user-settings-phoneNumber-input` (INPUT directly)
- `user-settings-submit` (BUTTON)
- `bankaccount-submit` (BUTTON)
- `transaction-comment-input-{id}` (INPUT directly)
- `user-list-search-input` (INPUT directly)

---

## XState Auth Behavior

The frontend uses XState for authentication state management:

```
localStorage key: "authState"
Values: {"value": "authorized" | "unauthorized" | "loading"}
```

**Critical for tests:**

- An API-only login (`POST /login` via `request.newContext()`) sets the session cookie but NOT the XState localStorage state. XState boots to "unauthorized" → redirects every page to `/signin`.
- `global-setup.ts` must log in **through the UI** (goto /signin → fill → click Sign In → wait for page content) to capture `storageState` with `authState="authorized"`.
- To log out in tests: clear `localStorage` AND cookies. Just clearing cookies leaves XState as "authorized" → redirects `/signin` → `/`.

---

## Pagination

All list endpoints support pagination:

- `page` (1-based integer)
- `limit` (items per page, default 10)
- Response `pageData`: `{page, limit, hasNextPages: boolean, totalPages: number}`

After seed:

- Public feed: 5 total pages (10/page = ~50 transactions)
- Contacts feed: 48 total pages
- Personal feed: 36 total pages
- Notifications: 8 unread notifications
