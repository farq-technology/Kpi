CREATE TABLE survey_responses (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id               UUID REFERENCES surveys(id) ON DELETE CASCADE,
    arcgis_object_id        INTEGER,
    arcgis_global_id        VARCHAR(128) UNIQUE,

    -- Surveyor info
    surveyor_username       VARCHAR(128),
    surveyor_name           VARCHAR(255),
    surveyor_email          VARCHAR(255),
    agent_id                VARCHAR(64),

    -- POI info
    poi_name_ar             TEXT,
    poi_name_en             TEXT,
    category                VARCHAR(128),
    secondary_category      VARCHAR(128),
    company_status          VARCHAR(64),
    phone_number            VARCHAR(64),
    website                 TEXT,
    social_media            TEXT,
    working_days            TEXT,
    working_hours           TEXT,
    break_time              TEXT,
    holidays                TEXT,
    language                TEXT,
    payment_methods         TEXT,
    commercial_license      VARCHAR(128),
    building_number         VARCHAR(64),
    floor_number            VARCHAR(64),
    entrance_location       TEXT,

    -- Boolean amenities
    dine_in                 VARCHAR(10),
    has_family_seating      VARCHAR(10),
    has_parking_lot         VARCHAR(10),
    wifi                    VARCHAR(10),
    is_wheelchair_accessible VARCHAR(10),
    cuisine                 TEXT,
    offers_iftar_menu       VARCHAR(10),
    is_open_during_suhoor   VARCHAR(10),

    -- Geographic data (PostGIS)
    location                GEOMETRY(Point, 4326),
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,

    -- Quality metrics
    is_complete             BOOLEAN DEFAULT true,
    missing_fields          TEXT[],
    compliance_score        DECIMAL(5,2),
    total_fields            INTEGER DEFAULT 0,
    filled_fields           INTEGER DEFAULT 0,

    -- Timing
    event_type              VARCHAR(20) NOT NULL DEFAULT 'addData',
    submitted_at            TIMESTAMPTZ,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw data
    raw_payload             JSONB,
    attributes              JSONB NOT NULL DEFAULT '{}',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_responses_location ON survey_responses USING GIST(location);
CREATE INDEX idx_responses_submitted_at ON survey_responses(submitted_at);
CREATE INDEX idx_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_responses_category ON survey_responses(category);
CREATE INDEX idx_responses_agent ON survey_responses(surveyor_username);
CREATE INDEX idx_responses_attributes ON survey_responses USING GIN(attributes);
