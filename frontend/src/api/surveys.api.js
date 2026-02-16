import client from './client';

export const getSurveys = (params = {}) =>
  client.get('/surveys', { params });

export const getSurveyById = (id) =>
  client.get(`/surveys/${id}`);

export const updateSurvey = (id, data) =>
  client.put(`/surveys/${id}`, data);

export const getGeoJSON = () =>
  client.get('/surveys/geojson');
