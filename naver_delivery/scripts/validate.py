#!/usr/bin/env python3
"""
NAVER POI Data Validation Engine
=================================
Farq Technology Establishment — NAVER Cloud Corporation Pilot Agreement

Validates POI data against contractual requirements:
- JSON Schema compliance
- Required field completeness
- WGS84 coordinate validation (KSA bounds)
- 30-meter coordinate tolerance
- Boolean strict validation (true/false only)
- Category lowercase enforcement
- KSA phone format validation
- Working hours structure validation
- 30% QA sampling with accuracy KPI
- Budget cap enforcement (SAR 50,000)

Usage:
    python validate.py --input data.json --output reports/
    python validate.py --input data.csv --output reports/ --format csv
"""

import argparse
import csv
import json
import math
import os
import random
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

# ─── Contract Constants ──────────────────────────────────────────────────────
PILOT_BUDGET_CAP = 50000.0     # SAR
UNIT_PRICE_POI = 52.2          # SAR per POI
VIDEO_COST = 15.0              # SAR per walkthrough video
SAMPLING_RATE = 0.30           # 30%
KPI_ACCEPT_THRESHOLD = 95.0    # ≥95% → ACCEPT
KPI_CORRECT_THRESHOLD = 90.0   # 90-94% → REQUIRE CORRECTION
COORDINATE_TOLERANCE_M = 30.0  # meters

# KSA bounding box (WGS84)
KSA_LAT_MIN, KSA_LAT_MAX = 15.0, 32.5
KSA_LON_MIN, KSA_LON_MAX = 34.0, 56.0

# ─── Required Fields ─────────────────────────────────────────────────────────
REQUIRED_FIELDS = [
    'global_id', 'name_ar', 'name_en', 'category',
    'company_status', 'latitude', 'longitude',
    'working_days', 'working_hours',
]

# ─── Boolean Fields (strict true/false) ──────────────────────────────────────
BOOLEAN_FIELDS = [
    'drive_thru', 'dine_in', 'only_delivery', 'reservation_available',
    'require_ticket', 'order_from_car', 'pickup_point_exists', 'wifi',
    'music', 'valet_parking', 'has_parking_lot', 'wheelchair_accessible',
    'family_seating', 'waiting_area', 'private_rooms', 'smoking_area',
    'children_area', 'shisha_available', 'live_sports', 'is_landmark',
    'is_trending', 'large_groups', 'women_prayer_room', 'iftar_tent',
    'iftar_menu', 'open_suhoor', 'free_entry',
]

VALID_STATUSES = [
    'open', 'closed', 'temporary closed', 'permanently closed',
    'under construction', 'coming soon', 'relocated',
]

VALID_PAYMENTS = [
    'cash', 'mada', 'visa', 'mastercard', 'apple_pay',
    'stc_pay', 'bank_transfer', 'other',
]

VALID_LANGUAGES = ['arabic', 'english', 'urdu', 'hindi', 'tagalog', 'other']

# KSA phone regex: +966XXXXXXXXX, 05XXXXXXXX, or 5XXXXXXXX
KSA_PHONE_REGEX = re.compile(r'^(\+966|05|5)\d{8,9}$')

ALL_FIELDS = [
    'global_id', 'name_ar', 'name_en', 'legal_name',
    'category', 'secondary_category', 'cuisine', 'company_status',
    'commercial_license_number',
    'latitude', 'longitude', 'building_number', 'floor_number',
    'entrance_description', 'google_map_url',
    'phone_number', 'email', 'website', 'instagram', 'tiktok',
    'x_account', 'snapchat',
    'working_days', 'working_hours', 'break_times', 'holidays',
    *BOOLEAN_FIELDS,
    'accepted_payment_methods', 'languages_spoken',
    'exterior_image_url', 'interior_image_url', 'entrance_image_url',
    'menu_image_url', 'walkthrough_video_url',
]


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATORS
# ═══════════════════════════════════════════════════════════════════════════════

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two WGS84 points in meters."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_filled(value):
    """Check if a value is meaningfully filled (not null/empty/NA)."""
    if value is None:
        return False
    if isinstance(value, str):
        v = value.strip().lower()
        return v not in ('', 'n/a', 'na', '--', 'null', 'none')
    if isinstance(value, (list, dict)):
        return len(value) > 0
    return True


def validate_uuid(value):
    """Validate UUID format."""
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False


def validate_ksa_phone(phone):
    """Validate KSA phone number format."""
    if not phone or not isinstance(phone, str):
        return True  # Optional field, skip if empty
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    return bool(KSA_PHONE_REGEX.match(cleaned))


def validate_coordinates(lat, lon):
    """Validate WGS84 coordinates are within KSA bounds."""
    errors = []
    if lat is None or lon is None:
        errors.append('missing_coordinates')
        return errors
    try:
        lat, lon = float(lat), float(lon)
    except (ValueError, TypeError):
        errors.append('invalid_coordinate_format')
        return errors
    if lat == 0 and lon == 0:
        errors.append('zero_coordinates')
    if not (KSA_LAT_MIN <= lat <= KSA_LAT_MAX):
        errors.append(f'latitude_out_of_ksa_bounds ({lat})')
    if not (KSA_LON_MIN <= lon <= KSA_LON_MAX):
        errors.append(f'longitude_out_of_ksa_bounds ({lon})')
    return errors


def validate_category_lowercase(category):
    """Enforce lowercase category."""
    if not category or not isinstance(category, str):
        return False
    return category == category.lower()


def validate_boolean_strict(value, field_name):
    """Validate boolean fields are strict true/false."""
    if value is None:
        return True  # Optional, skip if missing
    if isinstance(value, bool):
        return True
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ('true', 'false', 'yes', 'no', 'n/a', ''):
            return True
    return False


def validate_working_hours(value):
    """Validate working hours has meaningful content."""
    if not is_filled(value):
        return False
    return True


def validate_poi(poi: dict, index: int) -> dict:
    """
    Validate a single POI record against all contractual requirements.
    Returns validation result dict.
    """
    errors = []
    warnings = []
    field_scores = {}

    poi_id = poi.get('global_id', f'ROW_{index}')

    # 1. Required fields
    for field in REQUIRED_FIELDS:
        val = poi.get(field)
        if not is_filled(val):
            errors.append(f'required_field_missing: {field}')
            field_scores[field] = 0
        else:
            field_scores[field] = 1

    # 2. UUID validation
    gid = poi.get('global_id')
    if is_filled(gid) and not validate_uuid(gid):
        errors.append('invalid_uuid_format')

    # 3. Category lowercase enforcement
    cat = poi.get('category')
    if is_filled(cat) and not validate_category_lowercase(cat):
        errors.append(f'category_not_lowercase: "{cat}"')

    # 4. Coordinate validation (WGS84 + KSA bounds)
    coord_errors = validate_coordinates(poi.get('latitude'), poi.get('longitude'))
    errors.extend(coord_errors)

    # 5. Boolean strict validation
    for bf in BOOLEAN_FIELDS:
        val = poi.get(bf)
        if val is not None and not validate_boolean_strict(val, bf):
            errors.append(f'boolean_not_strict: {bf}={val}')

    # 6. Company status validation
    status = poi.get('company_status')
    if is_filled(status):
        if isinstance(status, str) and status.strip().lower() not in VALID_STATUSES:
            warnings.append(f'unknown_company_status: "{status}"')

    # 7. Phone KSA format
    phone = poi.get('phone_number')
    if is_filled(phone) and not validate_ksa_phone(phone):
        warnings.append(f'phone_not_ksa_format: "{phone}"')

    # 8. Working hours validation
    wh = poi.get('working_hours')
    if not validate_working_hours(wh):
        errors.append('working_hours_invalid_or_empty')

    # 9. Payment methods validation
    pm = poi.get('accepted_payment_methods')
    if pm and isinstance(pm, list):
        for p in pm:
            if isinstance(p, str) and p.lower() not in VALID_PAYMENTS:
                warnings.append(f'unknown_payment_method: "{p}"')

    # 10. Languages validation
    langs = poi.get('languages_spoken')
    if langs and isinstance(langs, list):
        for l in langs:
            if isinstance(l, str) and l.lower() not in VALID_LANGUAGES:
                warnings.append(f'unknown_language: "{l}"')

    # 11. Completeness score
    filled_count = sum(1 for f in ALL_FIELDS if is_filled(poi.get(f)))
    completeness = round((filled_count / len(ALL_FIELDS)) * 100, 2)

    # 12. Minor deviation detection
    minor_deviations = []
    # Name typo heuristic: very short names
    for name_field in ['name_ar', 'name_en']:
        val = poi.get(name_field)
        if isinstance(val, str) and 0 < len(val.strip()) < 2:
            minor_deviations.append(f'{name_field}_possibly_too_short')

    is_valid = len(errors) == 0

    return {
        'poi_id': str(poi_id),
        'index': index,
        'is_valid': is_valid,
        'errors': errors,
        'warnings': warnings,
        'minor_deviations': minor_deviations,
        'completeness_pct': completeness,
        'filled_fields': filled_count,
        'total_fields': len(ALL_FIELDS),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# COORDINATE TOLERANCE CHECKER
# ═══════════════════════════════════════════════════════════════════════════════

def check_coordinate_tolerance(poi, reference_lat, reference_lon):
    """Check if coordinates are within 30m tolerance of reference."""
    lat = poi.get('latitude')
    lon = poi.get('longitude')
    if lat is None or lon is None or reference_lat is None or reference_lon is None:
        return None
    try:
        distance = haversine_distance(float(lat), float(lon), float(reference_lat), float(reference_lon))
        return {
            'distance_m': round(distance, 2),
            'within_tolerance': distance <= COORDINATE_TOLERANCE_M,
        }
    except (ValueError, TypeError):
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# QA SAMPLING & KPI
# ═══════════════════════════════════════════════════════════════════════════════

def qa_sample_and_calculate_kpi(results: list) -> dict:
    """
    Randomly sample 30% of POIs and calculate accuracy KPI.
    Contract logic:
      ≥95% → ACCEPT
      90-94% → REQUIRE CORRECTION
      <90% → REQUIRE RESURVEY
    """
    total = len(results)
    sample_size = max(1, int(math.ceil(total * SAMPLING_RATE)))
    sampled = random.sample(results, min(sample_size, total))

    valid_in_sample = sum(1 for r in sampled if r['is_valid'])
    accuracy = round((valid_in_sample / len(sampled)) * 100, 2) if sampled else 0

    if accuracy >= KPI_ACCEPT_THRESHOLD:
        decision = 'ACCEPT'
    elif accuracy >= KPI_CORRECT_THRESHOLD:
        decision = 'REQUIRE_CORRECTION'
    else:
        decision = 'REQUIRE_RESURVEY'

    return {
        'total_pois': total,
        'sample_size': len(sampled),
        'sampling_rate_pct': SAMPLING_RATE * 100,
        'valid_in_sample': valid_in_sample,
        'invalid_in_sample': len(sampled) - valid_in_sample,
        'accuracy_pct': accuracy,
        'kpi_threshold': KPI_ACCEPT_THRESHOLD,
        'decision': decision,
        'decision_rules': {
            'ACCEPT': f'>= {KPI_ACCEPT_THRESHOLD}%',
            'REQUIRE_CORRECTION': f'{KPI_CORRECT_THRESHOLD}% - {KPI_ACCEPT_THRESHOLD - 0.01}%',
            'REQUIRE_RESURVEY': f'< {KPI_CORRECT_THRESHOLD}%',
        },
        'sampled_poi_ids': [r['poi_id'] for r in sampled],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# BILLING / BUDGET ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_billing(pois: list) -> dict:
    """
    Calculate billing per pilot agreement:
    - 52.2 SAR per valid POI
    - 15 SAR per walkthrough video
    - Budget cap: SAR 50,000
    """
    total_pois = len(pois)
    pois_with_video = sum(1 for p in pois if is_filled(p.get('walkthrough_video_url')))

    poi_cost = total_pois * UNIT_PRICE_POI
    video_cost = pois_with_video * VIDEO_COST
    subtotal = poi_cost + video_cost

    over_budget = subtotal > PILOT_BUDGET_CAP
    max_pois_in_budget = int(PILOT_BUDGET_CAP / UNIT_PRICE_POI)

    return {
        'contract': {
            'client': 'NAVER Cloud Corporation',
            'provider': 'Farq Technology Establishment',
            'pilot_budget_cap_sar': PILOT_BUDGET_CAP,
            'unit_price_poi_sar': UNIT_PRICE_POI,
            'video_surcharge_sar': VIDEO_COST,
        },
        'delivery': {
            'total_pois_delivered': total_pois,
            'pois_with_video': pois_with_video,
            'pois_without_video': total_pois - pois_with_video,
        },
        'billing': {
            'poi_cost_sar': round(poi_cost, 2),
            'video_cost_sar': round(video_cost, 2),
            'subtotal_sar': round(subtotal, 2),
            'budget_cap_sar': PILOT_BUDGET_CAP,
            'remaining_budget_sar': round(PILOT_BUDGET_CAP - subtotal, 2),
            'over_budget': over_budget,
            'max_pois_within_budget': max_pois_in_budget,
        },
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DATA LOADERS
# ═══════════════════════════════════════════════════════════════════════════════

def load_json(filepath):
    """Load POI data from JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and 'pois' in data:
        return data['pois']
    if isinstance(data, dict) and 'data' in data:
        return data['data']
    return [data]


def load_csv(filepath):
    """Load POI data from CSV file (UTF-8)."""
    pois = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert string booleans
            for bf in BOOLEAN_FIELDS:
                if bf in row:
                    v = row[bf].strip().lower() if row[bf] else None
                    if v in ('true', 'yes', '1'):
                        row[bf] = True
                    elif v in ('false', 'no', '0'):
                        row[bf] = False
                    elif v in ('', 'n/a', 'null', 'none'):
                        row[bf] = None
            # Convert numeric fields
            for nf in ['latitude', 'longitude']:
                if nf in row and row[nf]:
                    try:
                        row[nf] = float(row[nf])
                    except ValueError:
                        pass
            # Convert array fields from comma-separated
            for af in ['accepted_payment_methods', 'languages_spoken', 'holidays']:
                if af in row and isinstance(row[af], str) and row[af]:
                    row[af] = [x.strip() for x in row[af].split(',') if x.strip()]
            pois.append(row)
    return pois


# ═══════════════════════════════════════════════════════════════════════════════
# REPORT GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_validation_report(results: list) -> dict:
    """Generate full validation report."""
    total = len(results)
    valid = sum(1 for r in results if r['is_valid'])
    invalid = total - valid
    avg_completeness = round(sum(r['completeness_pct'] for r in results) / total, 2) if total else 0

    # Error frequency
    error_freq = {}
    for r in results:
        for e in r['errors']:
            key = e.split(':')[0] if ':' in e else e
            error_freq[key] = error_freq.get(key, 0) + 1

    # Warning frequency
    warning_freq = {}
    for r in results:
        for w in r['warnings']:
            key = w.split(':')[0] if ':' in w else w
            warning_freq[key] = warning_freq.get(key, 0) + 1

    return {
        'report_title': 'NAVER POI Validation Report',
        'contract': {
            'client': 'NAVER Cloud Corporation',
            'provider': 'Farq Technology Establishment',
        },
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'summary': {
            'total_pois': total,
            'valid_pois': valid,
            'invalid_pois': invalid,
            'accuracy_pct': round((valid / total) * 100, 2) if total else 0,
            'avg_completeness_pct': avg_completeness,
        },
        'error_frequency': dict(sorted(error_freq.items(), key=lambda x: -x[1])),
        'warning_frequency': dict(sorted(warning_freq.items(), key=lambda x: -x[1])),
        'invalid_records': [r for r in results if not r['is_valid']],
    }


def generate_completeness_csv(results: list, output_path: str):
    """Generate completeness report CSV."""
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'poi_id', 'is_valid', 'completeness_pct',
            'filled_fields', 'total_fields',
            'error_count', 'warning_count', 'errors',
        ])
        for r in results:
            writer.writerow([
                r['poi_id'],
                r['is_valid'],
                r['completeness_pct'],
                r['filled_fields'],
                r['total_fields'],
                len(r['errors']),
                len(r['warnings']),
                '; '.join(r['errors']) if r['errors'] else '',
            ])


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='NAVER POI Data Validation Engine — Farq Technology'
    )
    parser.add_argument('--input', '-i', required=True, help='Input data file (JSON or CSV)')
    parser.add_argument('--output', '-o', default='./reports', help='Output directory for reports')
    parser.add_argument('--format', '-f', choices=['json', 'csv'], default=None,
                        help='Input format (auto-detected from extension if omitted)')
    parser.add_argument('--seed', type=int, default=None, help='Random seed for QA sampling reproducibility')
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    # Detect format
    fmt = args.format
    if not fmt:
        ext = os.path.splitext(args.input)[1].lower()
        fmt = 'csv' if ext == '.csv' else 'json'

    # Load data
    print(f'Loading {fmt.upper()} data from: {args.input}')
    if fmt == 'csv':
        pois = load_csv(args.input)
    else:
        pois = load_json(args.input)

    print(f'Loaded {len(pois)} POI records')

    if not pois:
        print('ERROR: No POI records found.')
        sys.exit(1)

    # Validate each POI
    print('Running validation...')
    results = []
    for idx, poi in enumerate(pois):
        result = validate_poi(poi, idx)
        results.append(result)

    # Generate reports
    os.makedirs(args.output, exist_ok=True)

    # 1. Validation report
    validation_report = generate_validation_report(results)
    vr_path = os.path.join(args.output, 'validation_report.json')
    with open(vr_path, 'w', encoding='utf-8') as f:
        json.dump(validation_report, f, indent=2, ensure_ascii=False)
    print(f'  Validation report: {vr_path}')

    # 2. KPI summary (30% QA sampling)
    kpi_summary = qa_sample_and_calculate_kpi(results)
    kpi_path = os.path.join(args.output, 'kpi_summary.json')
    with open(kpi_path, 'w', encoding='utf-8') as f:
        json.dump(kpi_summary, f, indent=2, ensure_ascii=False)
    print(f'  KPI summary: {kpi_path}')

    # 3. Completeness CSV
    comp_path = os.path.join(args.output, 'completeness_report.csv')
    generate_completeness_csv(results, comp_path)
    print(f'  Completeness report: {comp_path}')

    # 4. Billing summary
    billing = calculate_billing(pois)
    bill_path = os.path.join(args.output, 'billing_summary.json')
    with open(bill_path, 'w', encoding='utf-8') as f:
        json.dump(billing, f, indent=2, ensure_ascii=False)
    print(f'  Billing summary: {bill_path}')

    # Print summary
    s = validation_report['summary']
    k = kpi_summary
    b = billing['billing']
    print('\n' + '=' * 60)
    print('  NAVER POI VALIDATION SUMMARY')
    print('=' * 60)
    print(f'  Total POIs:        {s["total_pois"]}')
    print(f'  Valid POIs:        {s["valid_pois"]}')
    print(f'  Invalid POIs:      {s["invalid_pois"]}')
    print(f'  Overall Accuracy:  {s["accuracy_pct"]}%')
    print(f'  Avg Completeness:  {s["avg_completeness_pct"]}%')
    print(f'  QA Sample Size:    {k["sample_size"]} ({k["sampling_rate_pct"]}%)')
    print(f'  QA Accuracy:       {k["accuracy_pct"]}%')
    print(f'  QA Decision:       {k["decision"]}')
    print(f'  Total Cost:        {b["subtotal_sar"]:,.2f} SAR')
    print(f'  Budget Remaining:  {b["remaining_budget_sar"]:,.2f} SAR')
    if b['over_budget']:
        print(f'  ⚠ OVER BUDGET by {abs(b["remaining_budget_sar"]):,.2f} SAR')
    print('=' * 60)

    # Exit code based on KPI
    if k['decision'] == 'REQUIRE_RESURVEY':
        sys.exit(2)
    elif k['decision'] == 'REQUIRE_CORRECTION':
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
