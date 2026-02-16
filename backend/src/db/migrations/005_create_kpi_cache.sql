CREATE TABLE kpi_cache (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_type     VARCHAR(10) NOT NULL
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    survey_id       UUID REFERENCES surveys(id) ON DELETE CASCADE,

    total_responses         INTEGER NOT NULL DEFAULT 0,
    compliance_percentage   DECIMAL(5,2),
    media_usage_rate        DECIMAL(5,2),
    missing_data_percentage DECIMAL(5,2),
    total_images            INTEGER DEFAULT 0,
    total_videos            INTEGER DEFAULT 0,
    unique_surveyors        INTEGER DEFAULT 0,
    categories_count        JSONB DEFAULT '{}',
    agent_counts            JSONB DEFAULT '{}',
    status_counts           JSONB DEFAULT '{}',

    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_type, period_start, survey_id)
);

CREATE INDEX idx_kpi_cache_period ON kpi_cache(period_type, period_start);
