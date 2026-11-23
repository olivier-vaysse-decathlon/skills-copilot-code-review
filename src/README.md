# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Sign up for activities
- Read live school announcements
- Sign in as a teacher to create, edit, schedule, and delete announcements

## Getting Started

1. Install the dependencies:

   ```
   pip install -r requirements.txt
   ```

2. Start MongoDB on `localhost:27017`, then run the application from the repository root:

   ```
   uvicorn src.app:app --reload
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Sign up for an activity                                             |
| POST   | `/auth/login` | Sign in with a JSON body containing `username` and `password`; sets an HTTP-only session cookie |
| GET    | `/auth/check-session` | Get the signed-in teacher using the session cookie (401 when signed out) |
| POST   | `/auth/logout` | Revoke the current session and clear its cookie |
| GET    | `/announcements` | Public list of currently active announcements |
| GET    | `/announcements/manage` | List all announcements, including scheduled and expired messages; requires sign-in |
| POST   | `/announcements` | Create an announcement; requires sign-in; returns the created record (201) |
| PUT    | `/announcements/{id}` | Replace an announcement's message and dates; requires sign-in |
| DELETE | `/announcements/{id}` | Delete an announcement; requires sign-in; returns no content (204) |

### Managing announcements

After signing in, use **Announcements** in the header to open the management dialog.
It lists every announcement with a **Live now**, **Scheduled**, or **Expired** badge.
Use **+ New**, **Edit**, or **Delete**; deleting requires confirmation.
Each announcement accepts this JSON body:

```json
{
  "message": "Activity registration is open!",
  "starts_on": null,
  "expires_on": "2027-01-31"
}
```

- `message`: required plain text, 1–2,000 characters after trimming whitespace.
- `expires_on`: required ISO calendar date (`YYYY-MM-DD`).
- `starts_on`: optional ISO calendar date; omit it or use `null` to publish immediately.
  When supplied, it must be on or before `expires_on`.
- Dates are inclusive and evaluated in UTC. An announcement expires at midnight UTC
  after its expiration date. Past dates are allowed for editing archived messages.
- Responses include `id`, `message`, `starts_on`, and `expires_on`. List endpoints
  return arrays. Invalid input returns 422; missing announcements return 404.
- The public banner refreshes every minute and immediately after management changes.
  When nothing is active, the banner is hidden.
- Sessions last eight hours, are stored in MongoDB, and are revoked on logout.
  Cookies use `HttpOnly` and `SameSite=Strict`, with `Secure` enabled over HTTPS.
  **Authentication API change:** login credentials now use a JSON body rather
  than query parameters; `/auth/check-session` requires a session cookie instead
  of trusting a username. The bundled frontend uses the updated API.

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

3. **Announcements** - Uses a MongoDB-generated identifier:
   - Message
   - Optional start date
   - Required expiration date

Data is persisted in the `mergington_high` MongoDB database. Initialization in
`backend/database.py` adds an example announcement, expiring 30 days later, when
the announcements collection is first created. Deleting all announcements does
not recreate the example on restart. Expired announcements remain available to
signed-in users until explicitly deleted.
