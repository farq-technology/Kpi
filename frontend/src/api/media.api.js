import client, { API_BASE } from './client';

export const getMedia = (params = {}) =>
  client.get('/media', { params });

export const getMediaDownloadUrl = (id) =>
  `${API_BASE}/api/v1/media/${id}/download`;

export const getArcGISAttachments = (objectIds) =>
  client.get('/media/arcgis-attachments', { params: { objectIds } });
