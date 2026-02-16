import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as mediaApi from '../../api/media.api';

export default function MediaGallery() {
  const { t } = useTranslation();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setLoading(true);
        const params = { page, limit: 24 };
        if (filter) params.type = filter;
        const res = await mediaApi.getMedia(params);
        setMedia(res.data || []);
        setPagination(res.pagination || {});
      } catch (err) {
        console.error('Error fetching media:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [page, filter]);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div>
      {/* Filters */}
      <div className="filter-bar">
        <button className={`btn ${filter === '' ? 'btn-primary' : ''}`} onClick={() => { setFilter(''); setPage(1); }}>
          {t('media.all')}
        </button>
        <button className={`btn ${filter === 'image' ? 'btn-primary' : ''}`} onClick={() => { setFilter('image'); setPage(1); }}>
          {t('media.images')}
        </button>
        <button className={`btn ${filter === 'video' ? 'btn-primary' : ''}`} onClick={() => { setFilter('video'); setPage(1); }}>
          {t('media.videos')}
        </button>
      </div>

      {/* Gallery */}
      {media.length === 0 ? (
        <div className="loading-container">{t('table.noData')}</div>
      ) : (
        <div className="media-grid">
          {media.map(item => (
            <div key={item.id} className="media-item">
              {item.media_category === 'image' ? (
                <a href={mediaApi.getMediaDownloadUrl(item.id)} target="_blank" rel="noopener noreferrer">
                  <img
                    src={mediaApi.getMediaDownloadUrl(item.id)}
                    alt={item.file_name}
                    loading="lazy"
                    onError={(e) => { e.target.parentElement.innerHTML = '<div style="height:180px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;color:#999">No preview</div>'; }}
                  />
                </a>
              ) : item.media_category === 'video' ? (
                <video
                  src={mediaApi.getMediaDownloadUrl(item.id)}
                  controls
                  preload="metadata"
                  style={{ width: '100%', height: '180px', objectFit: 'cover', background: '#000' }}
                />
              ) : (
                <div style={{
                  height: '180px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: '#f0f0f0', fontSize: '40px',
                }}>
                  {'\uD83C\uDFA4'}
                </div>
              )}
              <div className="media-item-info">
                <div>{item.poi_name_ar || item.poi_name_en || item.file_name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span className={`badge ${item.media_category === 'image' ? 'blue' : 'purple'}`}>
                    {item.keyword || item.media_category}
                  </span>
                  <span>{item.file_size_bytes ? `${(item.file_size_bytes / 1024).toFixed(0)} KB` : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '16px' }}>
          <span className="pagination-info">
            {t('table.showing')} {media.length} {t('table.of')} {pagination.total}
          </span>
          <div className="pagination-buttons">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>&laquo;</button>
            <span style={{ padding: '8px 12px', fontSize: '14px' }}>
              {t('table.page')} {page} {t('table.of')} {pagination.totalPages}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>&raquo;</button>
          </div>
        </div>
      )}
    </div>
  );
}
