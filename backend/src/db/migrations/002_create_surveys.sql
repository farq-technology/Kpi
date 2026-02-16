CREATE TABLE surveys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_item_id    VARCHAR(128) NOT NULL,
    form_title      VARCHAR(255) NOT NULL,
    service_item_id VARCHAR(128),
    service_url     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(form_item_id)
);

CREATE INDEX idx_surveys_form_item_id ON surveys(form_item_id);
