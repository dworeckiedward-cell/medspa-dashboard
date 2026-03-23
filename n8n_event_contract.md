# n8n Event Ingest Contract

This document is the single source of truth for what n8n sends to the Dashboard backend. Every GoHighLevel / Retell webhook that you want reflected in the dashboard must be translated to one of the shapes below and forwarded to the ingest endpoint.

---

## Endpoint

```
POST /api/ingest
```

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-api-key` | value of `N8N_API_KEY` env var |

---

## Common Fields (every event)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `clientSlug` | string | **Yes** | Identifies the client, e.g. `"revive"` |
| `type` | string | **Yes** | One of the allowed event types listed below |
| `ts` | string (ISO 8601) | **Yes** | Event timestamp, e.g. `"2024-06-15T14:30:00Z"` |
| `contactId` | string | No | GoHighLevel contact ID |
| `phone` | string | No | E.164 format — `"+15551234567"` |
| `meta` | object | No | Event-specific fields (see per-type docs) |

---

## Allowed Event Types

### `lead_created`

Fires when a new contact enters GoHighLevel (Facebook Lead Ad, landing page form, etc.).

```json
{
  "clientSlug": "revive",
  "type": "lead_created",
  "ts": "2024-06-15T14:30:00Z",
  "contactId": "ghl_abc123",
  "phone": "+15551234567",
  "meta": {
    "speed_to_lead_sec": 47,
    "source": "facebook_ads",
    "first_name": "Emily"
  }
}
```

**`meta` fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `speed_to_lead_sec` | number | Recommended | Seconds from lead creation to first outreach attempt. Used for the Avg Speed-to-Lead KPI. |
| `source` | string | No | Traffic source, e.g. `"facebook_ads"`, `"google_ads"`, `"referral"` |
| `first_name` | string | No | Contact first name |

**Dashboard effect:** `leads +1`; `avgSpeedSec` recomputed for the day.

---

### `sms_sent`

Fires when an outbound SMS is dispatched to a contact.

```json
{
  "clientSlug": "revive",
  "type": "sms_sent",
  "ts": "2024-06-15T14:30:47Z",
  "contactId": "ghl_abc123",
  "phone": "+15551234567",
  "meta": {
    "template": "initial_outreach",
    "message_id": "ghl_msg_xyz789"
  }
}
```

**`meta` fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `template` | string | No | Template name used |
| `message_id` | string | No | GoHighLevel message ID |

> **Compliance note:** Do not include opt-out instructions (STOP/UNSUBSCRIBE keywords) in the `template` value or any metadata stored here. Carrier-compliant opt-out language lives in the actual message body managed inside GoHighLevel.

**Dashboard effect:** `contacted +1`

---

### `call_started`

Fires when Retell initiates an outbound call.

```json
{
  "clientSlug": "revive",
  "type": "call_started",
  "ts": "2024-06-15T14:35:00Z",
  "contactId": "ghl_abc123",
  "phone": "+15551234567",
  "meta": {
    "call_id": "retell_call_a1b2c3d4",
    "agent_id": "retell_agent_xyz"
  }
}
```

**`meta` fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `call_id` | string | Recommended | Retell call ID — use same value in `call_ended` |
| `agent_id` | string | No | Retell agent ID |

**Dashboard effect:** `contacted +1`, `calls +1`

---

### `call_ended`

Fires when Retell reports a call result. This is the **source of truth** for the Answered Calls KPI.

```json
{
  "clientSlug": "revive",
  "type": "call_ended",
  "ts": "2024-06-15T14:38:22Z",
  "contactId": "ghl_abc123",
  "phone": "+15551234567",
  "meta": {
    "call_id": "retell_call_a1b2c3d4",
    "in_voicemail": false,
    "duration_sec": 202,
    "call_summary": "Prospect is interested in Botox, requested pricing."
  }
}
```

**`meta` fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `in_voicemail` | boolean | **Yes** | `false` = live answered call; `true` = went to voicemail |
| `duration_sec` | number | Recommended | Total call length in seconds |
| `call_id` | string | Recommended | Retell call ID (match with `call_started`) |
| `call_summary` | string | No | AI-generated summary from Retell |

**Dashboard effect:** if `in_voicemail === false` → `answered +1`; otherwise no metric change.

---

### `booking_link_sent`

Fires when a booking/scheduling link is dispatched to a contact (typically after a successful call).

```json
{
  "clientSlug": "revive",
  "type": "booking_link_sent",
  "ts": "2024-06-15T14:39:05Z",
  "contactId": "ghl_abc123",
  "phone": "+15551234567",
  "meta": {
    "booking_url": "https://book.revivemedspa.com/consultation",
    "channel": "sms"
  }
}
```

**`meta` fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `booking_url` | string | Recommended | The URL sent to the contact |
| `channel` | string | No | `"sms"` or `"email"` |

**Dashboard effect:** `bookingLinks +1`

---

## Metric Update Summary

| Event type | `leads` | `contacted` | `calls` | `answered` | `bookingLinks` | `avgSpeedSec` |
|-----------|:-------:|:-----------:|:-------:|:----------:|:--------------:|:-------------:|
| `lead_created` | +1 | — | — | — | — | recomputed |
| `sms_sent` | — | +1 | — | — | — | — |
| `call_started` | — | +1 | +1 | — | — | — |
| `call_ended` (`in_voicemail: false`) | — | — | — | +1 | — | — |
| `call_ended` (`in_voicemail: true`) | — | — | — | — | — | — |
| `booking_link_sent` | — | — | — | — | +1 | — |
| `payment_confirmed` | — | — | — | — | — | — |
| `campaign_completed` | — | — | — | — | — | — |

> `avgSpeedSec` for a day is the mean of all `meta.speed_to_lead_sec` values from `lead_created` events on that calendar day (UTC).

---

### `payment_confirmed`

Fires when a Stripe Checkout Session is completed (deposit paid).

```json
{
  "clientSlug": "live-younger",
  "type": "payment_confirmed",
  "ts": "2026-03-06T15:00:00Z",
  "phone": "+14035551234",
  "meta": {
    "stripe_session_id": "cs_live_xxx",
    "amount_cents": 5000,
    "currency": "cad",
    "jane_appointment_id": "12345"
  }
}
```

**`meta` fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `stripe_session_id` | string | **Yes** | Stripe checkout session ID |
| `amount_cents` | number | **Yes** | Deposit amount in minor units |
| `currency` | string | **Yes** | ISO 4217 currency code |
| `jane_appointment_id` | string | No | Jane App appointment ID |

**Dashboard effect:** Logs payment confirmation. Used for deposit tracking.

---

### `campaign_completed`

Fires when a reactivation campaign finishes all calls.

```json
{
  "clientSlug": "live-younger",
  "type": "campaign_completed",
  "ts": "2026-03-06T18:00:00Z",
  "meta": {
    "campaign_name": "Spring Promo 2026",
    "total_called": 45,
    "answered": 32,
    "booked": 8,
    "not_interested": 12
  }
}
```

**`meta` fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `campaign_name` | string | **Yes** | Campaign identifier |
| `total_called` | number | **Yes** | Total outbound calls made |
| `answered` | number | **Yes** | Calls answered by patient |
| `booked` | number | **Yes** | Appointments booked |
| `not_interested` | number | No | Patients who declined |

**Dashboard effect:** Logs campaign summary. Displayed in Campaigns tab.

---

## Success / Error Responses

**Success (HTTP 200):**
```json
{ "ok": true }
```

**Validation error (HTTP 400):**
```json
{ "error": "Human-readable description of what's wrong" }
```

**Auth error (HTTP 401):**
```json
{ "error": "Unauthorized" }
```

**Client not found (HTTP 404):**
```json
{ "error": "Client not found" }
```

---

## n8n HTTP Request Node Configuration

```
Method:   POST
URL:      https://your-domain.vercel.app/api/ingest
```

**Headers:**
```
Content-Type  application/json
x-api-key     {{ $env.N8N_API_KEY }}
```

**Body (JSON — map from your GHL/Retell trigger fields):**
```json
{
  "clientSlug": "revive",
  "type":       "{{ $json.eventType }}",
  "ts":         "{{ $json.dateCreated }}",
  "contactId":  "{{ $json.contactId }}",
  "phone":      "{{ $json.phone }}",
  "meta":       {}
}
```

Populate `meta` with the appropriate fields for each event type using n8n's expression editor.
