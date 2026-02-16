CREATE TABLE media_attachments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id             UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    arcgis_attachment_id    INTEGER NOT NULL,
    arcgis_global_id        VARCHAR(128),
    file_name               VARCHAR(255) NOT NULL,
    content_type            VARCHAR(128) NOT NULL,
    media_category          VARCHAR(20) NOT NULL
        CHECK (media_category IN ('image', 'video', 'audio', 'document')),
    keyword                 VARCHAR(128),
    file_size_bytes         BIGINT,
    arcgis_url              TEXT NOT NULL,
    download_status         VARCHAR(20) DEFAULT 'pending'
        CHECK (download_status IN ('pending', 'downloaded', 'failed')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_response_id ON media_attachments(response_id);
CREATE INDEX idx_media_category ON media_attachments(media_category);
CREATE INDEX idx_media_keyword ON media_attachments(keyword);
