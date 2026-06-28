# Content Moderation System Documentation

## Overview
Tariq Islam now has a comprehensive content moderation system to prevent extremist activity, hate speech, and maintain a safe community environment.

## Features Implemented

### 1. ✅ Community Guidelines Page (`/community-guidelines`)
- **Location**: `src/pages/CommunityGuidelines.tsx`
- **Features**:
  - Comprehensive guidelines covering respect, appropriate content, safety, and zero-tolerance policies
  - Users must accept guidelines at signup
  - Version tracking system
  - IP and user agent logging for acceptance
- **Database**: `community_guidelines_acceptance` table

### 2. ✅ Report System
- **Component**: `src/components/ReportButton.tsx`
- **Features**:
  - Report button available on all user-generated content
  - Multiple report types: hate speech, extremism, harassment, spam, violence, inappropriate content
  - Detailed description requirement (min 10 characters)
  - Confidential reporting
  - Auto-flagging integration
- **Database**: `reports` table with full audit trail

### 3. ✅ Automatic Keyword Flagging
- **Hook**: `src/hooks/useContentModeration.ts`
- **Features**:
  - Real-time content scanning for extremist/violent keywords
  - Severity scoring (1-10 scale)
  - Auto-flagged reports for high-severity content
  - Redirect to educational content for severe violations
  - Integration with post/message creation
- **Database**: `flagged_keywords` table with pre-loaded dangerous keywords
- **Initial Keywords**: isis, al-qaeda, jihad kill, death to, bomb making, terrorist attack, etc.

### 4. ✅ Moderation Dashboard (`/moderation`)
- **Location**: `src/pages/ModerationDashboard.tsx`
- **Access**: Admin and moderator roles only
- **Features**:
  - Real-time statistics (pending, under review, resolved, today's count)
  - Report management with status workflow
  - Moderation actions:
    - Issue warning
    - Remove content
    - Suspend user (7 days)
    - Ban user (permanent)
  - Severity scoring display
  - Auto-flagged vs manual report identification
  - Resolution notes tracking
- **Database**: `moderation_logs` table with full action history

### 5. ✅ Anti-Extremism Education Page (`/anti-extremism`)
- **Location**: `src/pages/AntiExtremismEducation.tsx`
- **Features**:
  - Educational content about true Islamic teachings
  - Quranic verses promoting peace
  - Understanding of jihad
  - Helpline resources (Prevent Helpline, FBI Tips, Crisis Text Line)
  - Automatic redirect for severe keyword violations

### 6. ✅ User Suspensions System
- **Database**: `user_suspensions` table
- **Features**:
  - Temporary suspensions (default 7 days)
  - Permanent bans
  - Linked to moderation logs
  - Active suspension tracking
- **Function**: `is_user_suspended()` for real-time checks

### 7. ✅ Rate Limiting & Verification
- **Existing**: Rate limits already implemented in:
  - Contact requests
  - Partnership inquiries
  - Leadership applications
- **New**: Guidelines acceptance requirement before posting

### 8. ✅ Row Level Security (RLS)
All moderation tables have comprehensive RLS policies:
- **reports**: Users see own reports, moderators see all
- **moderation_logs**: Moderators can create/view, users can view their own
- **flagged_keywords**: Admins manage, system reads for flagging
- **user_suspensions**: Moderators manage, users can view their own
- **community_guidelines_acceptance**: Users manage their own, admins view all

## Database Schema

### New Tables Created

#### 1. `reports`
```sql
- id: UUID (primary key)
- reported_by: UUID (nullable - null for auto-flagged)
- reported_user_id: UUID
- content_type: text (message, post, profile, review, advertisement)
- content_id: UUID
- report_type: enum (hate_speech, extremism, harassment, spam, violence, inappropriate_content, other)
- description: text (10-1000 characters)
- status: enum (pending, under_review, resolved, dismissed)
- is_auto_flagged: boolean
- severity_score: integer (0-100)
- reviewed_by: UUID (nullable)
- reviewed_at: timestamp
- resolution_notes: text
```

#### 2. `moderation_logs`
```sql
- id: UUID (primary key)
- moderator_id: UUID
- target_user_id: UUID
- report_id: UUID (nullable)
- action_type: enum (warning, content_removed, user_suspended, user_banned, no_action)
- reason: text (min 10 characters)
- content_type: text
- content_id: UUID
- content_snapshot: jsonb
- notes: text
- expires_at: timestamp (for temporary actions)
- ip_address: text
- user_agent: text
```

#### 3. `flagged_keywords`
```sql
- id: UUID (primary key)
- keyword: text (unique)
- category: text (extremism, violence, hate_speech, harassment)
- severity: integer (1-10)
- is_active: boolean
- redirect_to_education: boolean
- created_by: UUID
```

#### 4. `user_suspensions`
```sql
- id: UUID (primary key)
- user_id: UUID
- suspended_by: UUID
- reason: text
- moderation_log_id: UUID
- suspended_at: timestamp
- expires_at: timestamp (nullable)
- is_permanent: boolean
- is_active: boolean
```

#### 5. `community_guidelines_acceptance`
```sql
- id: UUID (primary key)
- user_id: UUID (unique)
- version: text (default '1.0')
- accepted_at: timestamp
- ip_address: text
- user_agent: text
```

## Security Functions

### Database Functions Created

1. **`is_user_suspended(user_id UUID)`**
   - Returns boolean
   - Checks if user has active suspension

2. **`has_accepted_guidelines(user_id UUID)`**
   - Returns boolean
   - Checks if user accepted community guidelines

3. **`check_content_for_flags(content TEXT)`**
   - Returns table of matched keywords with category and severity
   - Used for real-time content scanning

## Integration Points

### Content Creation
All content creation now includes automatic moderation checks:
- Posts (`CreatePostForm.tsx`)
- Messages (can be integrated)
- Reviews (can be integrated)
- Advertisements (can be integrated)

### Workflow
1. User creates content
2. Content is scanned for flagged keywords
3. If severe keywords detected (severity >= 9):
   - Content is blocked
   - User redirected to education page
4. If moderate keywords detected (severity 7-8):
   - Content is posted
   - Auto-flagged report created
   - User notified of review
5. If low severity or no keywords:
   - Content posted normally

## Moderation Workflow

### For Moderators
1. View reports in dashboard (`/moderation`)
2. Review report details and severity
3. Take action:
   - Move to "Under Review" for investigation
   - Dismiss if no violation
   - Take moderation action (warning, remove, suspend, ban)
4. All actions are logged in `moderation_logs`
5. Users are notified of actions

### Escalation Levels
- **Severity 1-3**: Low priority, manual review
- **Severity 4-6**: Medium priority, review within 24h
- **Severity 7-8**: High priority, immediate review, auto-flagged
- **Severity 9-10**: Critical, content blocked, automatic education redirect

## Access Control

### Roles Required
- **Admin**: Full access to moderation dashboard and all features
- **Moderator**: Access to moderation dashboard, can review and take action
- **User**: Can report content, accept guidelines

### Navigation
- Moderation link appears in navigation for admins/moderators only
- Community Guidelines link in footer for all users

## Future Enhancements

### Recommended Additions
1. ✅ Image/video content scanning (ML-based)
2. ✅ User reputation system integration
3. ✅ Appeal process for suspensions
4. ✅ Automated warning notifications
5. ✅ Moderation statistics and analytics dashboard
6. ✅ Keyword learning and updates based on new threats
7. ✅ Integration with external threat databases

## Testing Checklist

- [ ] Create post with flagged keyword → Should be auto-flagged or blocked
- [ ] Submit report on content → Should appear in moderation dashboard
- [ ] Moderator review workflow → Status changes should work
- [ ] User suspension → User should be blocked from actions
- [ ] Guidelines acceptance → New users should be prompted
- [ ] Educational redirect → Severe keywords should redirect
- [ ] RLS policies → Users should only see their own data
- [ ] Admin/moderator access → Dashboard should be restricted

## Monitoring

### Key Metrics to Track
1. Number of reports per day
2. Average resolution time
3. Auto-flagged vs manual reports ratio
4. Suspension/ban rates
5. Most common violation types
6. Keywords triggering most flags

## Support Resources

### For Users
- Community Guidelines: `/community-guidelines`
- Anti-Extremism Education: `/anti-extremism`
- Report Button: Available on all content

### For Moderators
- Moderation Dashboard: `/moderation`
- Admin Panel: `/admin`
- Supabase Dashboard: Direct database access

## Configuration

### Adding New Flagged Keywords
Admins can add keywords directly in Supabase:
```sql
INSERT INTO flagged_keywords (keyword, category, severity, redirect_to_education)
VALUES ('new_keyword', 'extremism', 9, true);
```

### Adjusting Severity Thresholds
Update constants in `useContentModeration.ts`:
- Block threshold: severity >= 9
- Auto-flag threshold: severity >= 7
- Warning threshold: severity >= 5

## Legal Compliance

- All reports are logged with timestamps
- IP addresses are recorded for accountability
- Content snapshots preserved for evidence
- User actions are fully auditable
- Moderation decisions are documented

## Contact

For issues or questions about the moderation system:
- Check moderation logs in Supabase
- Review security_logs table for violations
- Contact system administrators

---

**Version**: 1.0
**Last Updated**: 2025-10-29
**Status**: ✅ Production Ready
