-- Daily KPI view
CREATE OR REPLACE VIEW v_daily_kpi AS
SELECT
    DATE_TRUNC('day', submitted_at)::DATE AS day,
    COUNT(*) AS total_responses,
    AVG(compliance_score) AS avg_compliance,
    COUNT(DISTINCT surveyor_username) AS unique_surveyors,
    COUNT(*) FILTER (WHERE NOT is_complete)::DECIMAL / NULLIF(COUNT(*), 0) * 100
        AS missing_data_pct
FROM survey_responses
GROUP BY DATE_TRUNC('day', submitted_at)::DATE
ORDER BY day DESC;

-- Category distribution view
CREATE OR REPLACE VIEW v_category_distribution AS
SELECT
    category,
    COUNT(*) AS count,
    COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM survey_responses), 0) * 100 AS percentage
FROM survey_responses
WHERE category IS NOT NULL
GROUP BY category
ORDER BY count DESC;

-- Agent performance view
CREATE OR REPLACE VIEW v_agent_performance AS
SELECT
    surveyor_username AS agent,
    COUNT(*) AS total_submissions,
    AVG(compliance_score) AS avg_compliance,
    COUNT(*) FILTER (WHERE is_complete) AS complete_submissions,
    COUNT(DISTINCT category) AS categories_covered
FROM survey_responses
WHERE surveyor_username IS NOT NULL
GROUP BY surveyor_username
ORDER BY total_submissions DESC;
