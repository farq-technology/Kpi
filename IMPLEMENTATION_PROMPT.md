# KPI Portal – Implementation Prompt (Quick Review Path)

This document is structured as a **ready-to-use implementation prompt**. Use it phase-by-phase.

---

## 1. Stack & Config

| Item | Value |
|------|-------|
| **Node** | (any LTS) |
| **Backend** | Express ^4.18.2, pg ^8.11.3 |
| **Database** | PostgreSQL (production) or SQLite (local via better-sqlite3). Unified via `backend/src/config/database.js` – uses `$1` params for pg, converts to `?` for SQLite. |
| **Frontend** | Vite 5.2, React 18.3 |
| **API base** | `/api/v1` (proxied from Vite to `localhost:3000`) |
| **Env vars** | `PORT`, `DATABASE_URL`, `FRONTEND_URL`, `WEBHOOK_SECRET`, `ARCGIS_USERNAME`, `ARCGIS_PASSWORD`, `ARCGIS_SERVICE_URL` |
| **Frontend env** | `VITE_API_URL` (optional, defaults to empty = relative `/api/v1`) |

### Folder structure (relevant)

```
Kpi/
├── backend/
│   ├── src/
│   │   ├── config/       # env.js, database.js
│   │   ├── controllers/  # survey.controller.js, kpi.controller.js
│   │   ├── routes/v1/   # index.js, surveys.routes.js, kpi.routes.js
│   │   └── db/          # pool.js -> database, migrations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/         # client.js, surveys.api.js, kpi.api.js
│   │   ├── components/  # tables/SurveyTable.jsx
│   │   ├── hooks/       # useSurveys.js
│   │   ├── pages/       # SurveysPage.jsx, SurveyDetailPage.jsx
│   │   └── context/     # FilterContext.jsx
│   ├── public/locales/  # en/translation.json, ar/translation.json
│   └── package.json
└── IMPLEMENTATION_PROMPT.md (this file)
```

---

## 2. Sample Data & Schema

### survey_responses (relevant columns)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| surveyor_username | VARCHAR | agent |
| poi_name_ar, poi_name_en | TEXT | |
| category, company_status | VARCHAR | |
| compliance_score | DECIMAL(5,2) | 0–100 |
| is_complete | BOOLEAN | 0 or 1 |
| missing_fields | TEXT[] (pg) / JSON (sqlite) | e.g. `["phone_number","website","working_hours"]` |
| submitted_at | TIMESTAMPTZ | |
| total_fields, filled_fields | INTEGER | |

### Sample row (conceptual)

```json
{
  "id": "a1b2c3d4-...",
  "poi_name_ar": "مطعم النخبة",
  "poi_name_en": "Elite Restaurant",
  "category": "Restaurant",
  "company_status": "Open",
  "surveyor_username": "Ahmad Shuban",
  "compliance_score": 65.5,
  "is_complete": 0,
  "missing_fields": ["website", "social_media", "working_hours"],
  "submitted_at": "2024-02-10T14:30:00Z"
}
```

**Note:** `missing_fields` can be PostgreSQL array or SQLite JSON text. Parse as `Array.isArray(mf) ? mf : (typeof mf === 'string' ? JSON.parse(mf || '[]') : [])`.

---

## 3. Translation Keys (Add Upfront)

Add to **both** `frontend/public/locales/en/translation.json` and `frontend/public/locales/ar/translation.json`:

```json
"review": {
  "needsReview": "Needs Review",
  "all": "All",
  "missingFields": "Missing Fields",
  "missingFieldsCount": "{{count}} fields",
  "fieldsToComplete": "Fields to complete"
}
```

**Arabic (ar/translation.json):**

```json
"review": {
  "needsReview": "تحتاج مراجعة",
  "all": "الكل",
  "missingFields": "الحقول الناقصة",
  "missingFieldsCount": "{{count}} حقول",
  "fieldsToComplete": "حقول تحتاج إكمال"
}
```

---

## 4. Design Preferences (Concrete)

- **Filter buttons:** Two options: `All` | `Needs Review`. Use `btn` for inactive, `btn btn-primary` for active (same pattern as existing buttons).
- **Badges:** Use existing `.badge` classes: `green` (compliance ≥80), `yellow` (60–79), `red` (<60). For missing count: `badge` with `orange` or `yellow` to show “3 fields”.
- **Cards:** Keep existing `detail-card`, `detail-row` style. For missing-fields block: `detail-card` with a light yellow/orange left border (e.g. `border-left: 4px solid #f59e0b`).
- **Layout:** No new page; enhance existing Surveys page and SurveyDetailPage.

---

## 5. Phase 1 – Do This Now: Quick Review Filter

**Implement Phase 1 only.** Do not implement auth, new pages, or migrations.

---

### Task 5.1 – Backend: Extend `listSurveys`

**File:** `backend/src/controllers/survey.controller.js`

**Current `listSurveys` function (lines 5–66):**

```javascript
async function listSurveys(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const agent = req.query.agent || '';

    let where = 'WHERE 1=1';
    const params = [];

    if (search) { ... }
    if (category) { ... }
    if (agent) { ... }

    const countQuery = `SELECT COUNT(*) FROM survey_responses ${where}`;
    // ...
    const dataQuery = `
      SELECT
        id, arcgis_object_id, arcgis_global_id,
        surveyor_username, poi_name_ar, poi_name_en,
        category, secondary_category, company_status,
        phone_number, website,
        latitude, longitude,
        is_complete, compliance_score,
        event_type, submitted_at, created_at
      FROM survey_responses
      ${where}
      ORDER BY submitted_at DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    // ...
  }
}
```

**Required changes:**

1. Read `needsReview` from `req.query.needsReview` (truthy = filter).
2. When `needsReview` is truthy, add:  
   `(compliance_score < 80 OR compliance_score IS NULL OR is_complete = 0)`
3. Read `sort` from `req.query.sort`. If `sort === 'compliance'`, use:  
   `ORDER BY compliance_score ASC NULLS FIRST, submitted_at DESC NULLS LAST`  
   Otherwise keep current: `ORDER BY submitted_at DESC NULLS LAST`.
4. Add `missing_fields` to the `SELECT` list.

**Input/Output example:**

- **Input:** `GET /api/v1/surveys?needsReview=true&sort=compliance&page=1&limit=25`
- **Output:** Same shape as before: `{ success: true, data: [...], pagination: {...} }`, with each row including `missing_fields`.

**Generate the full updated `listSurveys` function.**

---

### Task 5.2 – Frontend: Add filter to SurveysPage

**File:** `frontend/src/pages/SurveysPage.jsx`

**Current structure:**

```javascript
const [page, setPage] = useState(1);
const [search, setSearch] = useState('');
const { data, pagination, loading } = useSurveys({
  page,
  limit: 500,
  search,
});
```

**Required changes:**

1. Add state: `const [needsReview, setNeedsReview] = useState(false)`.
2. Pass to useSurveys: `needsReview, sort: needsReview ? 'compliance' : undefined`.
3. Add two buttons above the table: “All” | “Needs Review”. When “Needs Review” is active, `needsReview === true`. Use `t('review.all')` and `t('review.needsReview')`. Reset `page` to 1 when switching.

**Generate the full updated SurveysPage.jsx.**

---

### Task 5.3 – Frontend: Add missing-fields column to SurveyTable

**File:** `frontend/src/components/tables/SurveyTable.jsx`

**Current columns:** poiNameAr, poiNameEn, category, status, agent, compliance, date, actions.

**Required changes:**

1. Add a new column header after “compliance”: use `t('review.missingFields')`.
2. In each row, show a badge with count of `missing_fields`. Parse safely:  
   `const mf = row.missing_fields; const count = Array.isArray(mf) ? mf.length : (typeof mf === 'string' ? (JSON.parse(mf || '[]') || []).length : 0);`
3. If count > 0: show `t('review.missingFieldsCount', { count })` in a small badge (e.g. `badge orange` or `badge yellow`). If 0, show `-` or nothing.
4. Update `colSpan` in the “no data” row from 8 to 9.

**Generate the full updated SurveyTable.jsx.**

---

### Task 5.4 – Frontend: Add missing-fields section to SurveyDetailPage

**File:** `frontend/src/pages/SurveyDetailPage.jsx`

**Current:** Detail cards for basic info and detail fields. No `missing_fields` section.

**Required changes:**

1. Parse `survey.missing_fields` as above.
2. If there are any missing fields, add a new `detail-card` **before** the basic info card. Use a left border (e.g. `borderLeft: '4px solid #f59e0b'`).
3. Title: `t('review.fieldsToComplete')`.
4. Render each missing field as a bullet or row. Use the raw field name (e.g. `phone_number`), or a simple lookup if you have one.
5. Keep existing layout and styling.

**Generate the full updated SurveyDetailPage.jsx.**

---

### Task 5.5 – Optional: Dashboard “Needs Review” count

**File:** `frontend/src/pages/DashboardPage.jsx` (or wherever KPI summary is used)

If you have a KPI summary API that returns counts:

- Add a count of items with `compliance_score < 80 OR is_complete = 0`.
- If no such endpoint exists, you can add `GET /api/v1/kpi/needs-review-count` returning `{ count: N }` and a small card linking to `/surveys?needsReview=true`.

Otherwise, skip this task.

---

## 6. Checklist (Phase 1 Only)

- [ ] Backend: `listSurveys` accepts `needsReview`, `sort`, returns `missing_fields`.
- [ ] Frontend: `SurveysPage` has All | Needs Review toggle, passes params to `useSurveys`.
- [ ] Frontend: `SurveyTable` has “Missing Fields” column with count badge.
- [ ] Frontend: `SurveyDetailPage` has “Fields to complete” section when `missing_fields` exists.
- [ ] Translations: `review.*` keys added to `en` and `ar`.
- [ ] No new pages, no migrations, no auth.

---

## 7. Later Phases (Not Now)

- **Phase 2:** Auth (JWT + Express).
- **Phase 3:** UI overhaul (reference-style sidebar).
- **Phase 4:** Quality page, Progress page.
- **Phase 5:** Full review flow (approve/reject, review_status column).

---

## 8. How to Use This Document

For each session:

1. Copy the section for the task you want (e.g. Task 5.1).
2. Paste your current file content if needed.
3. Say: “Implement Task 5.1. Here’s my current survey.controller.js: [paste]. Generate the exact code changes.”
4. Apply the changes, then move to the next task.
