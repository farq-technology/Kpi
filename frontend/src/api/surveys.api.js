import client from './client';

export const getSurveys = (params = {}) =>
  client.get('/surveys', { params });

export const getSurveyById = (id) =>
  client.get(`/surveys/${id}`);

export const updateSurvey = (id, data) =>
  client.put(`/surveys/${id}`, data);

export const getGeoJSON = () =>
  client.get('/surveys/geojson');

export const getFilterOptions = () =>
  client.get('/surveys/filters');

export const getSurveyAttachments = (objectId) =>
  client.get(`/media/arcgis-attachments`, { params: { objectIds: objectId } });
