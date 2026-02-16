const config = require('./env');

const arcgisConfig = {
  username: config.arcgis.username,
  password: config.arcgis.password,
  serviceUrl: config.arcgis.serviceUrl,
  tokenUrl: config.arcgis.tokenUrl,
  portalUrl: config.arcgis.portalUrl,

  // Photo attachment keywords from the survey
  attachmentKeywords: {
    entrance_photo: 'صورة المدخل',
    license_photo: 'صورة الرخصة',
    business_exterior: 'الواجهة الخارجية (رئيسية)',
    exterior_photo_2: 'الواجهة الخارجية (ثانوية)',
    business_interior: 'الداخل (رئيسية)',
    interior_photo_2: 'الداخل (ثانوية)',
    menu_photo_1: 'صورة القائمة 1',
    menu_photo_2: 'صورة القائمة 2',
    menu_photo_3: 'صورة القائمة 3',
    additional_photo: 'صورة إضافية',
    interior_walkthrough_video: 'فيديو جولة داخلية',
  },
};

module.exports = arcgisConfig;
