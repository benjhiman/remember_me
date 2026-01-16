# WhatsApp Sales Automations

## Overview

WhatsApp Automations allow you to automatically send follow-up messages based on triggers (e.g., lead created, sale paid, no reply). This helps maintain engagement and improve sales conversion without manual intervention.

## Architecture

- **Rules**: Define trigger → action mappings with cooldown periods
- **Scheduler**: Creates `IntegrationJob` with future `runAt` when triggers fire
- **Antispam**: Cooldown check prevents duplicate messages within time window
- **Job Processor**: Executes automation actions (SEND_TEMPLATE or SEND_TEXT)

## Automation Rules Model

```typescript
{
  id: string;
  organizationId: string;
  name: string;
  trigger: WhatsAppAutomationTrigger;
  action: WhatsAppAutomationAction;
  payloadJson: {
    // For SEND_TEMPLATE:
    templateId: string;
    variables: { [key: string]: string };
    // For SEND_TEXT:
    text: string;
  };
  enabled: boolean;
  cooldownHours: number; // Default: 24
  createdAt: Date;
  updatedAt: Date;
}
```

## Triggers

### LEAD_CREATED
Fires when a new Lead is created.

**Context**:
- `leadId`: ID of the created lead
- Phone extracted from `Lead.phone`

**Example Use Case**: Welcome message when lead comes from WhatsApp

### SALE_RESERVED
Fires when a Sale status changes to `RESERVED`.

**Context**:
- `saleId`: ID of the sale
- Phone extracted from `Sale.customerPhone` or associated lead

**Example Use Case**: Confirmation message with order details

### SALE_PAID
Fires when a Sale status changes to `PAID`.

**Context**:
- `saleId`: ID of the sale
- Phone extracted from `Sale.customerPhone` or associated lead

**Example Use Case**: Payment confirmation and shipping info

### NO_REPLY_24H
Fires when a lead hasn't replied to last message in 24 hours.

**Context**:
- `leadId`: ID of the lead
- Phone extracted from `Lead.phone`

**Example Use Case**: Follow-up message to re-engage

## Actions

### SEND_TEMPLATE
Sends a pre-approved WhatsApp template.

**Payload**:
```json
{
  "templateId": "template-123",
  "variables": {
    "1": "John",
    "2": "#12345"
  }
}
```

**Behavior**:
1. Validates template is `APPROVED`
2. Renders variables in template placeholders
3. Calls WhatsApp Cloud API
4. Creates `MessageLog` with `automationRuleId` in metadata
5. Creates Note on Lead if `leadId` provided

### SEND_TEXT
Sends a plain text message.

**Payload**:
```json
{
  "text": "Hello! Your order is ready for pickup."
}
```

**Behavior**:
1. Calls WhatsApp Cloud API with text message
2. Creates `MessageLog` with `automationRuleId` in metadata
3. Creates Note on Lead if `leadId` provided

## Cooldown (Antispam)

Cooldown prevents sending duplicate messages within a time window.

**Logic**:
- Checks for recent `MessageLog` OUTBOUND to the same phone
- If message found within `cooldownHours`, rule is skipped
- Cooldown is per phone (not per organization)

**Example**:
- Rule with `cooldownHours: 24`
- Last message sent 12 hours ago → Cooldown active, rule skipped
- Last message sent 25 hours ago → Cooldown expired, rule executes

## API Endpoints

### List Automation Rules

```
GET /api/integrations/whatsapp/automations/rules?trigger=LEAD_CREATED&enabled=true&page=1&limit=20
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

**Response**:
```json
{
  "data": [
    {
      "id": "rule-123",
      "name": "Welcome Follow-up",
      "trigger": "LEAD_CREATED",
      "action": "SEND_TEMPLATE",
      "payloadJson": {
        "templateId": "template-456",
        "variables": {}
      },
      "enabled": true,
      "cooldownHours": 24,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

### Get Rule

```
GET /api/integrations/whatsapp/automations/rules/:id
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

### Create Rule (ADMIN/MANAGER/OWNER only)

```
POST /api/integrations/whatsapp/automations/rules
Authorization: Bearer <token>
X-Organization-Id: <org-id>

{
  "name": "Welcome Follow-up",
  "trigger": "LEAD_CREATED",
  "action": "SEND_TEMPLATE",
  "payloadJson": {
    "templateId": "template-123",
    "variables": {
      "1": "{{lead.name}}",
      "2": "{{lead.phone}}"
    }
  },
  "enabled": true,
  "cooldownHours": 24
}
```

### Update Rule (ADMIN/MANAGER/OWNER only)

```
PATCH /api/integrations/whatsapp/automations/rules/:id
Authorization: Bearer <token>
X-Organization-Id: <org-id>

{
  "enabled": false,
  "cooldownHours": 48
}
```

### Delete Rule (ADMIN/MANAGER/OWNER only)

```
DELETE /api/integrations/whatsapp/automations/rules/:id
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

Soft deletes the rule and sets `enabled: false`.

### Run Automation Now (ADMIN/MANAGER/OWNER only)

For testing or manual execution:

```
POST /api/integrations/whatsapp/automations/run-now
Authorization: Bearer <token>
X-Organization-Id: <org-id>

{
  "ruleId": "rule-123",
  "phone": "+1234567890",
  "leadId": "lead-456", // Optional
  "saleId": "sale-789"  // Optional
}
```

**Response**:
```json
{
  "jobId": "job-abc",
  "message": "Automation job created and will run immediately"
}
```

**Note**: Still respects cooldown. If cooldown active, returns `400 Bad Request`.

## Integration with Leads and Sales

**✅ AUTOMATICALLY INTEGRATED**: Triggers are automatically called from `LeadsService` and `SalesService`:

- **LEAD_CREATED**: Triggered automatically when `LeadsService.createLead()` completes (delay: 2 hours)
- **SALE_RESERVED**: Triggered automatically when `SalesService.createSale()` completes with status `RESERVED` (delay: 30 minutes)
- **SALE_PAID**: Triggered automatically when `SalesService.paySale()` completes (delay: 5 minutes)
- **NO_REPLY_24H**: Triggered automatically by `JobRunnerService` scanner (runs every 5 minutes by default)

No manual integration needed - automations fire automatically when events occur.

## Example Rules

### Welcome Message (Lead Created)

```json
{
  "name": "Welcome Message",
  "trigger": "LEAD_CREATED",
  "action": "SEND_TEMPLATE",
  "payloadJson": {
    "templateId": "welcome_template_id",
    "variables": {
      "1": "{{lead.name}}"
    }
  },
  "cooldownHours": 24
}
```

### Order Confirmation (Sale Reserved)

```json
{
  "name": "Order Confirmation",
  "trigger": "SALE_RESERVED",
  "action": "SEND_TEMPLATE",
  "payloadJson": {
    "templateId": "order_confirmation_id",
    "variables": {
      "1": "{{sale.saleNumber}}",
      "2": "{{sale.totalAmount}}"
    }
  },
  "cooldownHours": 2
}
```

### Payment Confirmation (Sale Paid)

```json
{
  "name": "Payment Confirmation",
  "trigger": "SALE_PAID",
  "action": "SEND_TEMPLATE",
  "payloadJson": {
    "templateId": "payment_confirmation_id",
    "variables": {
      "1": "{{sale.saleNumber}}"
    }
  },
  "cooldownHours": 1
}
```

### Re-engagement (No Reply 24H)

```json
{
  "name": "Re-engagement Follow-up",
  "trigger": "NO_REPLY_24H",
  "action": "SEND_TEXT",
  "payloadJson": {
    "text": "Hi! We noticed you haven't replied. Is there anything we can help you with?"
  },
  "cooldownHours": 48
}
```

## Job Scheduling

When a trigger fires:

1. **Find Enabled Rules**: Queries rules matching trigger and `enabled: true`
2. **Check Cooldown**: For each rule, checks if message sent recently
3. **Create Job**: Enqueues `AUTOMATION_ACTION` job with `runAt` = now + delay (based on trigger type)
4. **Job Processor**: When `runAt` arrives, job processor executes action

**Default Delays by Trigger**:
- `LEAD_CREATED`: 2 hours
- `SALE_RESERVED`: 30 minutes
- `SALE_PAID`: 5 minutes
- `NO_REPLY_24H`: 0 (immediate, already 24h passed)

**Example Timeline**:
- `T=0`: Lead created → Trigger fires
- `T=0`: Rule found, cooldown check passes
- `T=0`: Job created with `runAt = T+2h`
- `T=2h`: Job processor executes → Message sent

## Permissions

- **ADMIN/MANAGER/OWNER**: Full CRUD access to rules, can run manually
- **SELLER**: Can list and view rules, cannot create/edit/delete

## Best Practices

1. **Cooldown**: Set appropriate cooldown to avoid spam (24h default is good)
2. **Template Variables**: Use dynamic variables from context (lead name, sale number)
3. **Testing**: Use `run-now` endpoint to test rules before enabling
4. **Monitoring**: Check `MessageLog` with `automationRuleId` to track automation performance
5. **Disable Temporarily**: Set `enabled: false` instead of deleting to pause automations

## Environment Variables

Add these to your `.env` file:

```bash
# Job Runner (processes automation jobs)
JOB_RUNNER_ENABLED=true                      # Enable automatic job processing (default: false)
JOB_RUNNER_INTERVAL_MS=5000                  # Interval between job processing cycles in milliseconds (default: 5000)

# NO_REPLY_24H Scanner
NO_REPLY_SCAN_ENABLED=true                  # Enable NO_REPLY_24H scanner (default: false)
NO_REPLY_SCAN_INTERVAL_MS=300000            # Interval between scans in milliseconds (default: 300000 = 5 minutes)
```

## Troubleshooting

**Automation not firing**:
- Check rule is `enabled: true`
- Verify trigger is being called from service (check logs for "Failed to trigger" errors)
- Check cooldown hasn't blocked execution
- Verify phone number exists in lead/sale
- Check `JOB_RUNNER_ENABLED=true` if jobs aren't processing

**Job not executing**:
- Check `JOB_RUNNER_ENABLED=true` in env
- Verify job `runAt` is in the past
- Check job status in `IntegrationJob` table
- Verify `JobRunnerService` is running (check logs)

**NO_REPLY_24H not scanning**:
- Check `NO_REPLY_SCAN_ENABLED=true` in env
- Verify scanner interval is reasonable (default 5 minutes)
- Check logs for scanner errors
- Verify leads have phone numbers

**Template not found**:
- Ensure template is `APPROVED` status
- Verify `templateId` in `payloadJson` is correct
- Check template belongs to same organization
