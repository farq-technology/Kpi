import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useSurveys } from '../hooks/useSurveys';
import { reviewSurvey } from '../api/surveys.api';
import { Icon, Badge, ComplianceBar, CircleProgress, tokens } from '../components/review';

function parseMissingFields(mf) {
  if (!mf) return [];
  if (Array.isArray(mf)) return mf;
  try {
    const parsed = typeof mf === 'string' ? JSON.parse(mf || '[]') : mf;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapSurvey(row) {
  const missingFields = parseMissingFields(row.missing_fields);
  const compliance = Number(row.compliance_score) || 0;
  const status = (row.company_status || '').toLowerCase();
  const isOpen = status === 'open' || !status;
  return {
    id: row.id,
    name: row.poi_name_ar || row.poi_name_en || row.id,
    agent: row.surveyor_username || '—',
    category: row.category || '—',
    compliance,
    isComplete: Boolean(row.is_complete),
    missingFields,
    status: isOpen ? 'open' : 'closed',
    location: row.category || '—',
    updatedAt: row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('ar-SA') : '—',
  };
}

export default function ReviewQueuePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';

  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [reviewStatuses, setReviewStatuses] = useState({});
  const [search, setSearch] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { data, pagination, loading } = useSurveys({
    page: 1,
    limit: 500,
    search: search || undefined,
    needsReview: true,
    sort: 'compliance',
  });

  const surveys = (data || []).map(mapSurvey);

  const filtered = surveys.filter((s) => {
    if (filter === 'critical') return s.compliance < 60;
    if (filter === 'warning') return s.compliance >= 60 && s.compliance < 80;
    if (filter === 'good') return s.compliance >= 80;
    return true;
  });

  const needsReviewCount = pagination?.total ?? filtered.length;
  const reviewedCount = Object.keys(reviewStatuses).length;
  const selectedIndex = filtered.findIndex((s) => s.id === selectedId);
  const selected = filtered.find((s) => s.id === selectedId);

  const handleAction = useCallback(async (id, action, notes) => {
    if (action === 'edit') {
      navigate(`/surveys/${id}/edit`);
      return;
    }

    setActionLoading(true);
    try {
      await reviewSurvey(id, { status: action, notes: notes || undefined });
      setReviewStatuses((prev) => ({ ...prev, [id]: action }));
      setShowRejectInput(false);
      setRejectNotes('');

      if (action === 'approved') {
        toast.success(t('review.approvedSuccess', 'Survey approved'));
      } else if (action === 'rejected') {
        toast.success(t('review.rejectedSuccess', 'Survey rejected'));
      }

      // Auto-advance to next
      setSelectedId((prevId) => {
        const idx = filtered.findIndex((s) => s.id === id);
        return idx < filtered.length - 1 ? filtered[idx + 1].id : prevId;
      });
    } catch (err) {
      console.error('Review action failed:', err);
      toast.error(t('review.actionFailed', 'Review action failed'));
    } finally {
      setActionLoading(false);
    }
  }, [navigate, filtered, t]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (actionLoading) return;
      if (e.key === 'n' || e.key === 'N') {
        if (selectedIndex < filtered.length - 1) setSelectedId(filtered[selectedIndex + 1].id);
      }
      if (e.key === 'p' || e.key === 'P') {
        if (selectedIndex > 0) setSelectedId(filtered[selectedIndex - 1].id);
      }
      if ((e.key === 'a' || e.key === 'A') && selectedId) handleAction(selectedId, 'approved');
      if ((e.key === 'e' || e.key === 'E') && selectedId) handleAction(selectedId, 'edit');
      if ((e.key === 'r' || e.key === 'R') && selectedId) setShowRejectInput(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIndex, filtered, selectedId, handleAction, actionLoading]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.3rem',
              fontWeight: 800,
              color: tokens.textPrimary,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {t('review.reviewQueue')}
          </h2>
          <p style={{ fontSize: '0.8rem', color: tokens.textMuted, margin: '4px 0 0' }}>
            {t('review.reviewSubtitle')}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: tokens.cardBg,
            padding: '8px 16px',
            borderRadius: 24,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <CircleProgress
            value={Math.round((reviewedCount / Math.max(needsReviewCount, 1)) * 100)}
            size={38}
            strokeWidth={3}
            color={tokens.primary}
          />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: tokens.textPrimary }}>
              {reviewedCount} {t('review.of')} {needsReviewCount}
            </div>
            <div style={{ fontSize: '0.65rem', color: tokens.textMuted }}>{t('review.reviewed')}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: tokens.cardBg,
            border: `1px solid ${tokens.border}`,
            borderRadius: 10,
            padding: '0 12px',
            flex: '1 1 200px',
            maxWidth: 320,
          }}
        >
          <Icon name="search" size={16} color={tokens.textMuted} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('review.searchPlaceholder')}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              padding: '10px 0',
              fontSize: '0.82rem',
              width: '100%',
              color: tokens.textPrimary,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
          {['all', 'critical', 'warning', 'good'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: filter === f ? 600 : 400,
                background: filter === f ? tokens.cardBg : 'transparent',
                color: filter === f ? tokens.textPrimary : tokens.textMuted,
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t(`review.${f}`)}
              {f === 'critical' && (
                <span style={{ marginInlineStart: 4, color: tokens.danger, fontSize: '0.7rem' }}>
                  {surveys.filter((s) => s.compliance < 60).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Always-visible keyboard shortcuts bar */}
      <div
        style={{
          background: tokens.sidebar,
          color: 'rgba(255,255,255,0.9)',
          padding: '8px 16px',
          borderRadius: 10,
          fontSize: '0.75rem',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Icon name="keyboard" size={14} color="rgba(255,255,255,0.5)" />
        {[
          ['N', t('review.next')],
          ['P', t('review.prev')],
          ['A', t('review.approve')],
          ['R', t('review.reject', 'Reject')],
          ['E', t('review.edit')],
        ].map(([key, label]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <kbd
              style={{
                background: 'rgba(255,255,255,0.15)',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 700,
                fontSize: '0.7rem',
              }}
            >
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selected ? '1fr 1fr' : '1fr',
          gap: 16,
          alignItems: 'start',
        }}
        className="detail-split"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                background: tokens.cardBg,
                borderRadius: 14,
                padding: '48px 24px',
                border: `1px solid ${tokens.border}`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: tokens.textPrimary }}>
                {t('review.noItemsToReview')}
              </div>
              <div style={{ fontSize: '0.82rem', color: tokens.textMuted, marginTop: 4 }}>
                {t('review.allCaughtUp')}
              </div>
            </div>
          ) : (
            filtered.map((survey) => {
              const isSelected = selectedId === survey.id;
              const status = reviewStatuses[survey.id];
              const borderColor =
                survey.compliance < 60
                  ? tokens.danger
                  : survey.compliance < 80
                    ? tokens.warning
                    : tokens.success;
              return (
                <div
                  key={survey.id}
                  onClick={() => setSelectedId(survey.id)}
                  style={{
                    background: tokens.cardBg,
                    borderRadius: 12,
                    padding: '14px 16px',
                    border: `1px solid ${isSelected ? tokens.primary : tokens.border}`,
                    borderInlineStart: `4px solid ${borderColor}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? `0 0 0 2px ${tokens.primary}22` : 'none',
                    opacity: status ? 0.6 : 1,
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = tokens.cardBg;
                  }}
                >
                  {status && (
                    <div style={{ position: 'absolute', top: 8, insetInlineEnd: 8 }}>
                      <Badge
                        type={
                          status === 'approved'
                            ? 'success'
                            : status === 'rejected'
                              ? 'danger'
                              : 'info'
                        }
                      >
                        {t(`review.${status}`)}
                      </Badge>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: tokens.textMuted,
                        fontFamily: 'monospace',
                      }}
                    >
                      {String(survey.id).slice(0, 8)}…
                    </span>
                    <span style={{ fontSize: '0.72rem', color: tokens.textMuted }}>·</span>
                    <span style={{ fontSize: '0.72rem', color: tokens.textMuted }}>{survey.location}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: tokens.textPrimary,
                      marginBottom: 8,
                    }}
                  >
                    {survey.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: tokens.textMuted }}>{survey.agent}</span>
                    {survey.missingFields.length > 0 && (
                      <Badge type="warning" size="xs">
                        {survey.missingFields.length} {isAr ? 'ناقص' : 'missing'}
                      </Badge>
                    )}
                    <div style={{ marginInlineStart: 'auto', width: 80 }}>
                      <ComplianceBar value={survey.compliance} height={5} showLabel />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selected && (
          <div
            style={{
              background: tokens.cardBg,
              borderRadius: 14,
              padding: '24px',
              border: `1px solid ${tokens.border}`,
              position: 'sticky',
              top: 80,
            }}
          >
            <button
              onClick={() => setSelectedId(null)}
              style={{
                position: 'absolute',
                top: 12,
                insetInlineEnd: 12,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <Icon name="close" size={18} color={tokens.textMuted} />
            </button>
            <div style={{ marginBottom: 20 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: tokens.textMuted,
                  fontFamily: 'monospace',
                }}
              >
                {String(selected.id).slice(0, 8)}…
              </span>
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: tokens.textPrimary,
                  margin: '6px 0',
                  letterSpacing: '-0.01em',
                }}
              >
                {selected.name}
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge type={selected.status === 'open' ? 'success' : 'default'}>
                  {t(`review.${selected.status}`)}
                </Badge>
                <Badge
                  type={
                    selected.compliance < 60
                      ? 'danger'
                      : selected.compliance < 80
                        ? 'warning'
                        : 'success'
                  }
                >
                  {selected.compliance}% {t('review.compliance')}
                </Badge>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <CircleProgress value={selected.compliance} size={88} strokeWidth={7} />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                { label: t('review.agent'), value: selected.agent, icon: 'user' },
                { label: t('review.location'), value: selected.location, icon: 'map' },
                { label: t('review.category'), value: selected.category, icon: 'filter' },
                { label: t('review.lastUpdated'), value: selected.updatedAt, icon: 'clock' },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: '#f8fafc',
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.65rem',
                      color: tokens.textMuted,
                      marginBottom: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Icon name={item.icon} size={12} color={tokens.textMuted} />
                    {item.label}
                  </div>
                  <div
                    style={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.textPrimary }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {selected.missingFields.length > 0 && (
              <div
                style={{
                  background: tokens.dangerLight,
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 20,
                  border: `1px solid ${tokens.danger}22`,
                }}
              >
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: tokens.danger,
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="alert" size={15} color={tokens.danger} />
                  {t('review.fieldsNeedCompletion')} ({selected.missingFields.length})
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.missingFields.map((field, i) => (
                    <span
                      key={i}
                      style={{
                        background: '#fff',
                        border: `1px solid ${tokens.danger}33`,
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: tokens.danger,
                      }}
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Reject notes textarea */}
            {showRejectInput && (
              <div style={{ marginBottom: 12 }}>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder={t('review.rejectReason', 'Reason for rejection...')}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1.5px solid ${tokens.danger}`,
                    fontSize: '0.82rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: 8,
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleAction(selected.id, 'rejected', rejectNotes)}
                    disabled={actionLoading}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      border: 'none', background: tokens.danger, color: '#fff',
                      fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                    }}
                  >
                    {actionLoading ? '...' : t('review.confirmReject', 'Confirm Reject')}
                  </button>
                  <button
                    onClick={() => { setShowRejectInput(false); setRejectNotes(''); }}
                    style={{
                      padding: '8px 14px', borderRadius: 8,
                      border: `1px solid ${tokens.border}`, background: 'transparent',
                      fontSize: '0.8rem', cursor: 'pointer',
                    }}
                  >
                    {t('edit.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => handleAction(selected.id, 'approved')}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  background: tokens.success,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                <Icon name="check" size={16} color="#fff" />
                {t('review.approve')}
              </button>
              <button
                onClick={() => handleAction(selected.id, 'edit')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: `1.5px solid ${tokens.primary}`,
                  background: 'transparent',
                  color: tokens.primary,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <Icon name="pencil" size={16} color={tokens.primary} />
                {t('review.edit')}
              </button>
              <button
                onClick={() => setShowRejectInput(!showRejectInput)}
                disabled={actionLoading}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: `1.5px solid ${tokens.danger}`,
                  background: showRejectInput ? tokens.danger : 'transparent',
                  color: showRejectInput ? '#fff' : tokens.danger,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <Icon name="x" size={16} color={showRejectInput ? '#fff' : tokens.danger} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={selectedIndex <= 0}
                onClick={() => selectedIndex > 0 && setSelectedId(filtered[selectedIndex - 1].id)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 8,
                  border: `1px solid ${tokens.border}`,
                  background: tokens.pageBg,
                  color: selectedIndex <= 0 ? tokens.textMuted : tokens.textPrimary,
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: selectedIndex <= 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  opacity: selectedIndex <= 0 ? 0.5 : 1,
                }}
              >
                <Icon name={isAr ? 'chevronRight' : 'chevronLeft'} size={14} />
                {t('review.prev')}
              </button>
              <button
                disabled={selectedIndex >= filtered.length - 1}
                onClick={() =>
                  selectedIndex < filtered.length - 1 &&
                  setSelectedId(filtered[selectedIndex + 1].id)
                }
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 8,
                  border: `1px solid ${tokens.border}`,
                  background: tokens.pageBg,
                  color:
                    selectedIndex >= filtered.length - 1
                      ? tokens.textMuted
                      : tokens.textPrimary,
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor:
                    selectedIndex >= filtered.length - 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  opacity: selectedIndex >= filtered.length - 1 ? 0.5 : 1,
                }}
              >
                {t('review.next')}
                <Icon name={isAr ? 'chevronLeft' : 'chevronRight'} size={14} />
              </button>
            </div>
            <div
              style={{
                marginTop: 14,
                textAlign: 'center',
                fontSize: '0.7rem',
                color: tokens.textMuted,
              }}
            >
              {selectedIndex + 1} {t('review.of')} {filtered.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
