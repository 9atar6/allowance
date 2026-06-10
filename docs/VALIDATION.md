# Validation log

One section per user. Verbatim quotes > paraphrases — write what they actually
said, especially the negative. This file decides whether Phase 7 gets built.

## Activation SQL (run in Supabase, weekly)

```sql
-- Requests + last activity per user
select u.email,
       count(e.id)                as requests,
       min(e.created_at)::date    as first_call,
       max(e.created_at)::date    as last_call
from auth.users u
left join public.usage_events e on e.user_id = u.id
group by u.email
order by requests desc;
```

Activated = real API connected + ≥50 requests + active again >7 days after
first call (see docs/LAUNCH.md).

## Scorecard

| # | Who / source | Keyed? | Real API? | ≥50 req? | Week-2 return? | Would pay? |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |

---

## User 1 — [name / handle] — [date]

- **Source:** [where you found them]
- **Their stack:** [provider(s), agent framework, scale]
- **How they cap spend today:** ""
- **Ever been burned?** ""
- **Reaction to the product:** ""
- **Friction during setup:** ""
- **Would they pay $20/mo?** ""
- **Follow-up promised:** [what you said you'd do]

## Call questions (use every time)

1. Walk me through the last time an API bill surprised you.
2. What do you do today to stop an agent overspending?
3. (Watch them set up, silently.) Where did they hesitate?
4. If this disappeared next month, what would you do?
5. Would you pay $20/mo? If no — what number, and for what?
