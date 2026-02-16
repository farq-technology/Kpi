const axios = require('axios');
const config = require('../config/env');

class ArcGISService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const response = await axios.post(
      config.arcgis.tokenUrl,
      new URLSearchParams({
        username: config.arcgis.username,
        password: config.arcgis.password,
        referer: config.arcgis.portalUrl,
        f: 'json',
      }),
      { timeout: 15000 }
    );

    const data = response.data;
    if (data.error) {
      throw new Error(`ArcGIS token error: ${data.error.message}`);
    }

    this.token = data.token;
    this.tokenExpiry = data.expires - 60000; // 1 min buffer
    return this.token;
  }

  async queryFeatures(params = {}) {
    const token = await this.getToken();
    const url = `${config.arcgis.serviceUrl}/query`;
    const allParams = {
      where: '1=1',
      returnGeometry: true,
      outFields: '*',
      f: 'json',
      token,
      ...params,
    };

    // Use POST for long where clauses to avoid URL length limits
    const whereLen = (allParams.where || '').length;
    if (whereLen > 500) {
      const response = await axios.post(url, new URLSearchParams(allParams), { timeout: 30000 });
      return response.data;
    }

    const response = await axios.get(url, { params: allParams, timeout: 30000 });
    return response.data;
  }

  async queryCount(where = '1=1') {
    const token = await this.getToken();
    const url = `${config.arcgis.serviceUrl}/query`;
    const response = await axios.get(url, {
      params: { where, returnCountOnly: true, f: 'json', token },
      timeout: 15000,
    });
    return response.data.count;
  }

  async queryStats(statisticDefinitions, groupBy = null) {
    const token = await this.getToken();
    const url = `${config.arcgis.serviceUrl}/query`;
    const params = {
      where: '1=1',
      outStatistics: JSON.stringify(statisticDefinitions),
      returnGeometry: false,
      f: 'json',
      token,
    };
    if (groupBy) {
      params.groupByFieldsForStatistics = groupBy;
    }
    const response = await axios.get(url, { params, timeout: 15000 });
    return response.data;
  }

  async queryAttachments(objectIds) {
    const token = await this.getToken();
    const url = `${config.arcgis.serviceUrl}/queryAttachments`;
    const response = await axios.get(url, {
      params: {
        objectIds: Array.isArray(objectIds) ? objectIds.join(',') : objectIds,
        f: 'json',
        token,
      },
      timeout: 30000,
    });
    return response.data.attachmentGroups || [];
  }

  async getAttachmentUrl(objectId, attachmentId) {
    const token = await this.getToken();
    return `${config.arcgis.serviceUrl}/${objectId}/attachments/${attachmentId}?token=${token}`;
  }

  async applyEdits(updates) {
    const token = await this.getToken();
    const url = `${config.arcgis.serviceUrl}/applyEdits`;
    const response = await axios.post(url, new URLSearchParams({
      updates: JSON.stringify(updates),
      f: 'json',
      token,
    }), { timeout: 30000 });

    const data = response.data;
    if (data.error) {
      throw new Error(`ArcGIS applyEdits error: ${data.error.message}`);
    }

    const results = data.updateResults || [];
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      throw new Error(`ArcGIS update failed for ${failed.length} feature(s): ${JSON.stringify(failed[0].error)}`);
    }

    return results;
  }

  async getGeoJSON(where = '1=1') {
    const token = await this.getToken();
    const url = `${config.arcgis.serviceUrl}/query`;
    const response = await axios.get(url, {
      params: {
        where,
        outFields: 'objectid,globalid,agent_name,name_ar,name_en,category,secondary_category,company_status,phone_number,CreationDate',
        returnGeometry: true,
        f: 'geojson',
        token,
      },
      timeout: 30000,
    });
    return response.data;
  }
}

module.exports = new ArcGISService();
