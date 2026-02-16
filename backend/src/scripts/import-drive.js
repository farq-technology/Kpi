/**
 * Import photos/videos from Google Drive folders and link to POIs
 * Each Drive subfolder is named: "POI Name Arabic - Working Hours"
 * This script:
 *  1. Parses Drive folder HTML to get subfolder names/IDs
 *  2. Matches POI names to survey_responses in DB
 *  3. Lists files in each subfolder
 *  4. Downloads and stores them locally, inserts media_attachments records
 *
 * Run: cd backend && node src/scripts/import-drive.js
 */
require('dotenv').config();
const pool = require('../db/pool');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Drive folder data (parsed from HTML)
const DRIVE_FOLDERS = [
  {"id":"1aStTBfgGbTC9CGIrt07uXIMOu19Y6o1J","name":"ذيه سول - ٩ونص صباحا الى ١٢ الليل"},
  {"id":"1dpMUkCS6p-eG5m-Y-fa9MemH6_hJ27dp","name":"آفاق البيئة - من ٨ صباحا إلى ٤ عصرا الجمعة و السبت مغلق"},
  {"id":"1P7gVj-4b9WNXTsQRoSSVFeKdCcphWGU0","name":"آمر - ٨ صباحا إلى ٥ مساء"},
  {"id":"17POzYkvGm1V4g07LTvnhfZ6NKPx2JUXW","name":"آير"},
  {"id":"127veDu-7e2mhfpZRCotoOA_uaT7a9zI9","name":"أبعاد الرؤية المستقلة للمقاولات - من ٩ صباحا إلى ٥ مساءا الجمعه و السبت مغلق"},
  {"id":"1NjR7PqBFoLI72yV0PdPUlOT_RFbnOcwt","name":"أزارا - ٩ ونص صباحا إلى ١١ ونص الليل يوم الجمعة يفتح ٢ ظهرا"},
  {"id":"1ikDfesPWHq-dRjbFAmD7elMc71gfDboW","name":"أسواق لي مارت - ٨ صباحا إلى ٢ الليل"},
  {"id":"1rbny1RI_1jlJa5BX5i-evuOCtWIZk6Oj","name":"أقمشة دكان كتان - من ٩ صباحا إلى ١٢ ظهرا ومن ٤ عصرا إلى ١١ ونص ليلا يوم الجمعة من ٤ عصرا إلى ١١ ونص ليلا"},
  {"id":"1R2hyK8AmVWbjhhmRzFOrs7ECfTxerbkE","name":"ألدو - ٩ ونص صباحا إلى ١١ ونص الليل"},
  {"id":"1Ib6JSWWRj7Njy2WgYCWvgG6xrKO-xS5N","name":"أم كوتور - مغلق موقتا"},
  {"id":"1i1ob69LoSgx7DutJtFo-hn8KVoiDPKJN","name":"أنواع القهوة - مغلق موقتا"},
  {"id":"1hFGMGzcXBraFXw0n0BiNhm4qmH7rVbfi","name":"أنوفا"},
  {"id":"10QCLefxN50rk5m_j8y63b3xzR2H9B-sB","name":"إبراق"},
  {"id":"1gbVjQPv90czUdwYZsd9Qaf5t2CDaA2BL","name":"إراف الطبية - ٨ صباحا إلى ٥ مساء الجمعة و السبت مغلق"},
  {"id":"1rldMbXMUJ2Na9i8uqdaCyot8qiL_LIGl","name":"إفران الحطب - ٦ صباحا إلى ١٢ ليلا"},
  {"id":"1H00g6RiGiawamRfwxS6XAeb5FV-CokWS","name":"اتمال- ٨ صباحا إلى ٥ مساءا الجمعه و السبت"},
  {"id":"17n-tA83YbJ9SEfEqx8wHq1rqempVBQ6U","name":"اجمل - من ١٠ صباحا إلى ١٢ الليل الدور ١"},
  {"id":"1I9X3mjIHP6DRY_fXNpeRAikgROMKM7u9","name":"احتياجات الحيوان من ١٠ صباحا إلى ١٢ ليلا يوم الجمعة من ٤ عصرا إلى ١٢ ليلا"},
  {"id":"1Do53NavFneKP5P2_VUgsGnkBE7u4lT_H","name":"احلا لبس للرياضه - من ٨ صباحا إلى ١٢ ليلا الجمعه ١٢ ظهرا إلى ١٢ ليلا"},
  {"id":"1Redu9wJnz7d-20JysrMQ9_s-hkrwkLrf","name":"احمد الدوسري محاسبون و مراجعون - ٨ صباحا إلى ١ ظهرا ومن ٢ ظهرا إلى ٥ مساءا الجمعه و السبت مغلق"},
  {"id":"1iWJL6GKhdFYpQ7IBYtC0AUBz4XsqmmAm","name":"ارتيفور - من ٩ صباحا إلى ١٢ ظهرا ومن ٤ عصرا إلى ١٠ مساءا الجمعه و السبت من ٤ عصرا إلى ١٠ مساءا"},
  {"id":"1PJA12cGVaLIBo2g8UWIiCM5WGpmS89XQ","name":"اردين - ٩ ونص صباحا الى ١١ ونص الليل الجمعه يفتح ٢ ظهرا"},
  {"id":"1D80Pg0_rA799aID56WInufVJEVy4z_eX","name":"اردين - من ٩ونص صباحاً إلى ١١ونص الليل الجمعه يفتح ٢ ظهرا"},
  {"id":"1ok1nQP2QElgvbiY4keLhkhs3VgZ5sKq7","name":"الإطار الفضي - ٧ ونص  صباحا الى ١٢ الليل"},
  {"id":"1pJGDG7wygq6XYwQ_ij9h0lSTzF-3cPeb","name":"الاتقان و التميز للمقاولات - مغلق موقتا"},
  {"id":"1_I-WFxah3MalzA-tjajP0JF818R_rMTV","name":"البيك - ١١ صباحا إلى ١٢ الليل"},
  {"id":"1ngDVtLOL30R2F9NCuSv4atccgh61QbB_","name":"التحليق الرياضية - من ٨ صباحا إلى ١٢ ليلا الجمعه مغلق"},
  {"id":"1Zvgpxtt9_hI0YGYhcK6hb0wj_O27j-xV","name":"التعديل السحري - ٩ صباحا إلى ١٠ ليلا يوم الجمعه مغلق"},
  {"id":"1-qs9rDIHXC1u3QqI3AW9rw8gnfY-bkmX","name":"التويجري"},
  {"id":"1u8qeWZRCcxRAxmGO_kkhsaGxhAHqhx7h","name":"التويجري للمستلزمات الرجالية - ٩ صباحا الى ١٢ ليلا يوم الجمعه يفتح ١ ظهرا"},
  {"id":"1IdfFEiL58qjSXL4JvvESiFb2DkM5vMPy","name":"الجازع - ١٠ صباحا الى ١٢ الليل"},
  {"id":"1RNfodO_d_RSr1gDnsjXFEoMdhUbwLMP7","name":"الجمعية الخيرية الصحية لرعاية المرضى - من ٨ صباحا إلى ٣ مساءا الجمعه و السبت مغلق"},
  {"id":"1ibVhts9AJnJmGCNWIpO5H1vaV93cLIHO","name":"الحميضي - ٩ ونص صباحا إلى ١١ونص الليل الجمعه يفتح ٤ عصرا"},
  {"id":"1nxwk1IoTuLTXjHJAa-t0u4gdUpErPIOT","name":"الدريس - على مدار الساعه"},
  {"id":"1UjhiL-SSpqoq1jnbR2bLNAhSfe_VoRnC","name":"الدفه - ٢ ظهرا إلى ١١ ليلا يوم الجمعة يفتح ٤ عصرا"},
  {"id":"1wXXoLZd9enLpXJvBcA1vSjTnwTJDzKvk","name":"الشبل الابيض - مغلق موقتا"},
  {"id":"1-w7_klaRVc9njH71ZBpOuZLlHi4G4fK9","name":"الصالة الشاملة - من ٨ صباحا الى ٤ مساءا الجمعه و السبت مغلق"},
  {"id":"1Wojto-tpD70jhVvTf208YBLvoo-uf5q4","name":"الصندوق الأبيض للديكور - مغلق موقتا"},
  {"id":"1JAGKjQnXc0icTwcZ-fH3sDSSfEpByjG4","name":"العثيم - من ٧ صباحا إلى ٢ ليلا"},
  {"id":"1Xn_P1rujQgcoFYhwBP8v71z4e7ngP-bv","name":"العربية للعود - ٩ونص صباحا إلى ١١ونص الليل الجمعه يفتح ٢ ظهرا"},
  {"id":"1aoYnlEKww4oEZYgFAFNqlyogQ5EqxiUK","name":"العربية للعود - من ٨ صباحاً إلى ٥ مساءً الجمعة و السبت مغلق"},
  {"id":"1g4Cbrn7I8xWTr9CT538rWFWPi-maDUpE","name":"العيون السليمة للنظارات - من ٤ ونص عصرا الى ١١ ليلا"},
  {"id":"1Wz46H6qV9ufkT5twwIG_fKCMAoV1TJGQ","name":"الفالينك - ٨ صباحا إلى ٥ عصرا"},
  {"id":"1l3NMfjQ45ljs2Q6_LbBf2Ir3XPP9qNoM","name":"الفنار - من ٨ صباحا إلى ٥ ونص مساء الجمعة و السبت مغلق"},
  {"id":"1Mq4A86hQkhWmZCGrebIvIWuSUwgCQ7UN","name":"الماجد للعود - ٩ونص صباحا إلى ١١ونص الليل الجمعه يفتح ٢ ظهرا"},
  {"id":"13k9YxEQnfjBe4q9uiaKDw3LKujgVWso3","name":"المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر - ٨ صباحا إلى ٤ عصرا الجمعة و السبت مغلق"},
  {"id":"15FST3_W_OrvbgPRti_NmRZZO1tdNlEtZ","name":"المسافر من ١٠ صباحا إلى ٤ عصرا"},
  {"id":"1YFMts2IL6qEDty1NjVV9BfbqOdlcysUF","name":"المسكوف - من ١٢ ظهرا إلى ١ ليلا"},
  {"id":"114Poeud0dt5Moz_NGZewSLxEXMnEV6sR","name":"المنظمة العالمية للمياه - ٨ صباحا إلى ٤ عصرا الجمعه و السبت مغلق"},
  {"id":"1NRjg9-mZJzPx5YA45mXCaFABVkqA14BJ","name":"المنيع - ٩ صباحا إلى ١١ ونص الليل الجمعه يفتح ١ ونص ظهرا يغلق ١١ ونص الليل"},
];

// Media storage directory
const MEDIA_DIR = path.join(__dirname, '..', '..', '..', 'media');

// Extract POI name from folder name (before " - " or the full name if no dash)
function extractPoiName(folderName) {
  // Split on " - " or "- "
  const parts = folderName.split(/\s*-\s*/);
  return parts[0].trim();
}

// Normalize Arabic text for matching
function normalize(text) {
  if (!text) return '';
  return text
    .replace(/[ًٌٍَُِّْ]/g, '') // Remove diacritics
    .replace(/ة/g, 'ه')         // ta marbuta -> ha
    .replace(/ى/g, 'ي')         // alef maqsura -> ya
    .replace(/أ|إ|آ/g, 'ا')     // all alef forms -> alef
    .replace(/\s+/g, ' ')       // normalize spaces
    .trim();
}

// Find best match in DB for a given name
function findMatch(driveName, dbRecords) {
  const normDrive = normalize(driveName);

  // Exact match
  let match = dbRecords.find(r => normalize(r.poi_name_ar) === normDrive);
  if (match) return { match, type: 'exact' };

  // Contains match
  match = dbRecords.find(r => {
    const normDb = normalize(r.poi_name_ar);
    return normDb.includes(normDrive) || normDrive.includes(normDb);
  });
  if (match) return { match, type: 'contains' };

  // Fuzzy: first 3 words match
  const driveWords = normDrive.split(' ').slice(0, 3).join(' ');
  if (driveWords.length > 3) {
    match = dbRecords.find(r => {
      const dbWords = normalize(r.poi_name_ar).split(' ').slice(0, 3).join(' ');
      return dbWords === driveWords;
    });
    if (match) return { match, type: 'fuzzy-3words' };
  }

  // Fuzzy: first 2 words match
  const driveWords2 = normDrive.split(' ').slice(0, 2).join(' ');
  if (driveWords2.length > 3) {
    match = dbRecords.find(r => {
      const dbWords = normalize(r.poi_name_ar).split(' ').slice(0, 2).join(' ');
      return dbWords === driveWords2;
    });
    if (match) return { match, type: 'fuzzy-2words' };
  }

  return null;
}

// Get file list from a Google Drive folder
async function listDriveFiles(folderId) {
  try {
    const url = `https://drive.google.com/drive/folders/${folderId}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
    });

    const html = response.data;
    const files = [];

    // Extract file entries with data-id and data-tooltip
    const regex = /data-id="([^"]+)"\s+jsname="vtaz5c"\s+data-tooltip="([^"]+)"/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      const fileId = m[1];
      const fileName = m[2];
      if (fileId === '_gd' || !fileName) continue;

      // Check if it's a file (not a folder) by looking for extension
      const ext = path.extname(fileName).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi', '.webm', '.heic', '.heif'].includes(ext)) {
        files.push({ id: fileId, name: fileName, ext });
      }
    }

    return files;
  } catch (err) {
    console.error(`  Error listing files for folder ${folderId}:`, err.message);
    return [];
  }
}

// Download a file from Google Drive
async function downloadDriveFile(fileId, destPath) {
  // Google Drive direct download URL
  const url = `https://drive.usercontent.google.com/download?id=${fileId}&confirm=t`;
  const response = await axios.get(url, {
    responseType: 'stream',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 60000,
    maxRedirects: 5,
  });

  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function main() {
  // Ensure media directory exists
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  // Load all DB records
  const { rows: dbRecords } = await pool.query(
    'SELECT id, poi_name_ar, poi_name_en FROM survey_responses WHERE poi_name_ar IS NOT NULL'
  );
  console.log(`DB has ${dbRecords.length} POIs`);
  console.log(`Drive has ${DRIVE_FOLDERS.length} folders\n`);

  // Step 1: Match folders to DB records
  const matches = [];
  const unmatched = [];

  for (const folder of DRIVE_FOLDERS) {
    const poiName = extractPoiName(folder.name);
    const result = findMatch(poiName, dbRecords);

    if (result) {
      matches.push({
        folderId: folder.id,
        folderName: folder.name,
        drivePoi: poiName,
        dbId: result.match.id,
        dbPoi: result.match.poi_name_ar,
        matchType: result.type,
      });
    } else {
      unmatched.push({ folderName: folder.name, drivePoi: poiName });
    }
  }

  console.log(`=== Matching Results ===`);
  console.log(`Matched: ${matches.length}/${DRIVE_FOLDERS.length}`);
  console.log(`Unmatched: ${unmatched.length}\n`);

  if (unmatched.length > 0) {
    console.log('Unmatched folders:');
    for (const u of unmatched) {
      console.log(`  - "${u.drivePoi}" (folder: ${u.folderName})`);
    }
    console.log('');
  }

  // Show matches
  for (const m of matches) {
    console.log(`[${m.matchType}] "${m.drivePoi}" -> "${m.dbPoi}"`);
  }
  console.log('');

  // Step 2: For each match, list files and download
  let totalFiles = 0;
  let totalDownloaded = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    console.log(`\n[${i + 1}/${matches.length}] Processing: ${m.drivePoi}`);

    const files = await listDriveFiles(m.folderId);
    console.log(`  Found ${files.length} media files`);
    totalFiles += files.length;

    if (files.length === 0) continue;

    // Create POI media directory
    const poiDir = path.join(MEDIA_DIR, m.dbId);
    if (!fs.existsSync(poiDir)) {
      fs.mkdirSync(poiDir, { recursive: true });
    }

    for (const file of files) {
      const destPath = path.join(poiDir, file.name);

      // Skip if already downloaded
      if (fs.existsSync(destPath)) {
        console.log(`  Skipped (exists): ${file.name}`);
        continue;
      }

      try {
        await downloadDriveFile(file.id, destPath);
        const stats = fs.statSync(destPath);

        // Determine media category
        const isVideo = ['.mp4', '.mov', '.avi', '.webm'].includes(file.ext);
        const contentType = isVideo ? `video/${file.ext.slice(1)}` : `image/${file.ext.slice(1) === 'jpg' ? 'jpeg' : file.ext.slice(1)}`;
        const mediaCategory = isVideo ? 'video' : 'image';

        // Determine keyword from filename
        let keyword = 'drive_upload';
        const nameLower = file.name.toLowerCase();
        if (nameLower.includes('entrance') || nameLower.includes('مدخل')) keyword = 'entrance_photo';
        else if (nameLower.includes('exterior') || nameLower.includes('واجه')) keyword = 'business_exterior';
        else if (nameLower.includes('interior') || nameLower.includes('داخل')) keyword = 'business_interior';
        else if (nameLower.includes('menu') || nameLower.includes('قائم')) keyword = 'menu_photo';
        else if (nameLower.includes('license') || nameLower.includes('رخص')) keyword = 'license_photo';

        // Insert into DB
        const id = crypto.randomUUID();
        const localUrl = `local://${m.dbId}/${file.name}`;

        await pool.query(
          `INSERT INTO media_attachments (id, response_id, file_name, content_type, media_category, keyword, file_size_bytes, arcgis_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, m.dbId, file.name, contentType, mediaCategory, keyword, stats.size, localUrl]
        );

        totalDownloaded++;
        console.log(`  Downloaded: ${file.name} (${(stats.size / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.error(`  Error downloading ${file.name}:`, err.message);
        // Remove partial file
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      }
    }

    // Small delay
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n=== Import Summary ===`);
  console.log(`Matched POIs: ${matches.length}`);
  console.log(`Total files found: ${totalFiles}`);
  console.log(`Total downloaded: ${totalDownloaded}`);

  // Final media stats
  const { rows: stats } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM media_attachments) as total_media,
      (SELECT COUNT(*) FROM media_attachments WHERE media_category = 'image') as images,
      (SELECT COUNT(*) FROM media_attachments WHERE media_category = 'video') as videos,
      (SELECT COUNT(*) FROM media_attachments WHERE arcgis_url LIKE 'local://%') as local_files
  `);
  console.log('\nDB Media Stats:', stats[0]);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
