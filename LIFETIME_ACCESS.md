# Lifetime Access Management

## Overview

The `hasLifetimeAccess` field allows you to grant unlimited free access to specific companies without requiring them to have an active subscription.

## How It Works

### Database Field

```prisma
model Company {
  hasLifetimeAccess Boolean @default(false)
  // ... other fields
}
```

### Middleware Behavior

When a company has `hasLifetimeAccess = true`:

- **Bypasses subscription checks** - No subscription required
- **All features unlocked** - Access to all premium features
- **Unlimited employees** - No employee count restrictions
- **No expiration** - Permanent access

### Mock Subscription

Companies with lifetime access get a virtual subscription with:

```javascript
{
  status: 'ACTIVE',
  plan: {
    name: 'Lifetime Access',
    features: ['attendance', 'leave', 'basic_reports', 'payroll', 'reports', 'performance', 'analytics', 'api_access', 'custom_integrations'],
    maxEmployees: null // unlimited
  }
}
```

## Usage

### Grant Lifetime Access

**Using npm script:**

```bash
cd backend
npm run grant:lifetime 1 5 10
```

**Manual script:**

```bash
node scripts/grant-lifetime-access.js grant 1 5 10
```

**Result:**

```
🔓 Granting lifetime access to 3 companies...
✅ Granted lifetime access to: Company A (ID: 1)
✅ Granted lifetime access to: Company B (ID: 5)
✅ Granted lifetime access to: Company C (ID: 10)
🎉 Lifetime access granted successfully to 3 companies!
```

### Revoke Lifetime Access

**Using npm script:**

```bash
npm run revoke:lifetime 1 5 10
```

**Manual script:**

```bash
node scripts/grant-lifetime-access.js revoke 1 5 10
```

### Manually via Database

**Grant access:**

```sql
UPDATE "Company"
SET "hasLifetimeAccess" = true
WHERE id IN (1, 5, 10);
```

**Revoke access:**

```sql
UPDATE "Company"
SET "hasLifetimeAccess" = false
WHERE id IN (1, 5, 10);
```

## Use Cases

1. **Beta testers** - Give early adopters free lifetime access
2. **Partners** - Provide complimentary access to partners
3. **Non-profits** - Offer free access to charitable organizations
4. **Affiliates** - Reward referral partners with free access
5. **Internal testing** - Grant access to test companies

## Security Considerations

- **Audit trail** - All lifetime access grants are logged in console
- **Database-backed** - Cannot be bypassed by frontend
- **Reversible** - Can be revoked at any time
- **No billing impact** - Doesn't affect subscription records

## Checking Lifetime Access

**Via API:**

```javascript
// Get company info
GET /api/company/info

// Response includes:
{
  "company": {
    "id": 1,
    "companyName": "Test Company",
    "hasLifetimeAccess": true
  }
}
```

**Via Database:**

```sql
SELECT id, "companyName", "hasLifetimeAccess"
FROM "Company"
WHERE "hasLifetimeAccess" = true;
```

## Implementation Details

### Middleware Logic

1. Check if company has `hasLifetimeAccess = true`
2. If yes, create mock subscription with all features
3. If no, proceed with regular subscription validation

### Feature Access

- **Lifetime companies** - Get all features automatically
- **Regular companies** - Get features based on their plan

### Employee Limits

- **Lifetime companies** - Unlimited employees
- **Regular companies** - Limited by plan

## Best Practices

1. **Document decisions** - Keep track of why lifetime access was granted
2. **Regular review** - Periodically review lifetime access companies
3. **Use sparingly** - Don't overuse to maintain business model integrity
4. **Set expiry dates** - Consider using grace period instead for temporary free access

## Future Enhancements

Consider adding:

- `lifetimeAccessGrantedAt` - Timestamp of when granted
- `lifetimeAccessGrantedBy` - Admin who granted access
- `lifetimeAccessReason` - Reason for granting access
- `lifetimeAccessExpiresAt` - Optional expiration date
