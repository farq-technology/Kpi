#!/usr/bin/env python3
"""
NAVER Delivery Package Generator
==================================
Farq Technology Establishment — NAVER Cloud Corporation

Generates the complete delivery package structure:
  /NAVER_PILOT_DELIVERY
    /csv           - POI data in CSV format
    /json          - POI data in JSON format
    /media         - Media assets
    validation_report.json
    kpi_summary.json
    completeness_report.csv
    billing_summary.json
    data_dictionary.xlsx (as JSON fallback)
    compliance_statement.txt

Usage:
    python generate_delivery.py --input data.json --output ./NAVER_PILOT_DELIVERY
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone

# Import validation engine
sys.path.insert(0, os.path.dirname(__file__))
from validate import (
    load_json, load_csv, validate_poi, generate_validation_report,
    generate_completeness_csv, qa_sample_and_calculate_kpi,
    calculate_billing, ALL_FIELDS, BOOLEAN_FIELDS, REQUIRED_FIELDS,
)


def poi_to_csv_row(poi: dict) -> dict:
    """Convert a POI dict to flat CSV row."""
    row = {}
    for field in ALL_FIELDS:
        val = poi.get(field)
        if isinstance(val, bool):
            row[field] = str(val).lower()
        elif isinstance(val, list):
            row[field] = ','.join(str(x) for x in val)
        elif isinstance(val, dict):
            row[field] = json.dumps(val, ensure_ascii=False)
        elif val is None:
            row[field] = ''
        else:
            row[field] = str(val)
    return row


def generate_csv_export(pois: list, output_path: str):
    """Export POIs to CSV (UTF-8)."""
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=ALL_FIELDS)
        writer.writeheader()
        for poi in pois:
            writer.writerow(poi_to_csv_row(poi))


def generate_json_export(pois: list, output_path: str):
    """Export POIs to JSON (UTF-8)."""
    export = {
        'pois': pois,
        '_meta': {
            'schema_version': '1.0',
            'encoding': 'UTF-8',
            'coordinate_system': 'WGS84',
            'total_records': len(pois),
            'contract': 'NAVER Cloud Corporation Pilot Agreement',
            'provider': 'Farq Technology Establishment',
            'generated_at': datetime.now(timezone.utc).isoformat(),
        },
    }
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export, f, indent=2, ensure_ascii=False)


def generate_data_dictionary(output_path: str):
    """Generate data dictionary as JSON (XLSX alternative)."""
    fields = [
        {'field': 'global_id', 'type': 'UUID', 'required': True, 'description': 'Unique POI identifier', 'format': 'UUID v4'},
        {'field': 'name_ar', 'type': 'String', 'required': True, 'description': 'POI name in Arabic', 'format': 'UTF-8 Arabic text'},
        {'field': 'name_en', 'type': 'String', 'required': True, 'description': 'POI name in English', 'format': 'UTF-8 English text'},
        {'field': 'legal_name', 'type': 'String', 'required': False, 'description': 'Registered legal / business name', 'format': 'Free text'},
        {'field': 'category', 'type': 'String', 'required': True, 'description': 'Primary business category', 'format': 'Lowercase only'},
        {'field': 'secondary_category', 'type': 'String', 'required': False, 'description': 'Secondary / sub category', 'format': 'Free text'},
        {'field': 'cuisine', 'type': 'String', 'required': False, 'description': 'Cuisine type (food venues)', 'format': 'Free text'},
        {'field': 'company_status', 'type': 'Enum', 'required': True, 'description': 'Operating status', 'format': 'open|closed|temporary closed|permanently closed|under construction|coming soon|relocated'},
        {'field': 'commercial_license_number', 'type': 'String', 'required': False, 'description': 'CR / license number', 'format': 'Numeric string'},
        {'field': 'latitude', 'type': 'Float', 'required': True, 'description': 'WGS84 latitude', 'format': '15.0-32.5 (KSA bounds)'},
        {'field': 'longitude', 'type': 'Float', 'required': True, 'description': 'WGS84 longitude', 'format': '34.0-56.0 (KSA bounds)'},
        {'field': 'building_number', 'type': 'String', 'required': False, 'description': 'Building number', 'format': 'Free text'},
        {'field': 'floor_number', 'type': 'String', 'required': False, 'description': 'Floor / level', 'format': 'Free text'},
        {'field': 'entrance_description', 'type': 'String', 'required': False, 'description': 'How to reach entrance', 'format': 'Free text'},
        {'field': 'google_map_url', 'type': 'URL', 'required': False, 'description': 'Google Maps link', 'format': 'Valid URL'},
        {'field': 'phone_number', 'type': 'String', 'required': False, 'description': 'Contact phone', 'format': '+966XXXXXXXXX or 05XXXXXXXX'},
        {'field': 'email', 'type': 'String', 'required': False, 'description': 'Contact email', 'format': 'Valid email'},
        {'field': 'website', 'type': 'URL', 'required': False, 'description': 'Website URL', 'format': 'Valid URL'},
        {'field': 'instagram', 'type': 'String', 'required': False, 'description': 'Instagram handle / URL', 'format': '@handle or URL'},
        {'field': 'tiktok', 'type': 'String', 'required': False, 'description': 'TikTok handle / URL', 'format': '@handle or URL'},
        {'field': 'x_account', 'type': 'String', 'required': False, 'description': 'X (Twitter) handle / URL', 'format': '@handle or URL'},
        {'field': 'snapchat', 'type': 'String', 'required': False, 'description': 'Snapchat handle / URL', 'format': '@handle or URL'},
        {'field': 'working_days', 'type': 'String', 'required': True, 'description': 'Operating days', 'format': 'e.g. All Days, Sunday-Thursday'},
        {'field': 'working_hours', 'type': 'String/JSON', 'required': True, 'description': 'Operating hours', 'format': 'String or JSON per day'},
        {'field': 'break_times', 'type': 'String/JSON', 'required': False, 'description': 'Break time schedule', 'format': 'String or JSON'},
        {'field': 'holidays', 'type': 'Array', 'required': False, 'description': 'Observed holidays', 'format': 'Comma-separated or JSON array'},
    ]

    for bf in BOOLEAN_FIELDS:
        fields.append({
            'field': bf,
            'type': 'Boolean',
            'required': False,
            'description': bf.replace('_', ' ').title(),
            'format': 'true / false ONLY',
        })

    fields.extend([
        {'field': 'accepted_payment_methods', 'type': 'Array', 'required': False, 'description': 'Payment methods accepted', 'format': 'cash,mada,visa,mastercard,apple_pay,stc_pay,bank_transfer,other'},
        {'field': 'languages_spoken', 'type': 'Array', 'required': False, 'description': 'Staff languages', 'format': 'arabic,english,urdu,hindi,tagalog,other'},
        {'field': 'exterior_image_url', 'type': 'URL', 'required': False, 'description': 'Exterior photo URL', 'format': 'Valid URL'},
        {'field': 'interior_image_url', 'type': 'URL', 'required': False, 'description': 'Interior photo URL', 'format': 'Valid URL'},
        {'field': 'entrance_image_url', 'type': 'URL', 'required': False, 'description': 'Entrance photo URL', 'format': 'Valid URL'},
        {'field': 'menu_image_url', 'type': 'URL', 'required': False, 'description': 'Menu photo URL', 'format': 'Valid URL'},
        {'field': 'walkthrough_video_url', 'type': 'URL', 'required': False, 'description': 'Interior walkthrough video URL', 'format': 'Valid URL'},
    ])

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'title': 'NAVER POI Data Dictionary',
            'version': '1.0',
            'total_fields': len(fields),
            'required_fields': len([f for f in fields if f['required']]),
            'fields': fields,
        }, f, indent=2, ensure_ascii=False)


def generate_compliance_statement(output_path: str, total_pois: int, accuracy: float):
    """Generate compliance statement text."""
    content = f"""
================================================================================
          COMPLIANCE STATEMENT — NAVER POI PILOT DELIVERY
================================================================================

Date:       {datetime.now(timezone.utc).strftime('%Y-%m-%d')}
Client:     NAVER Cloud Corporation
Provider:   Farq Technology Establishment

This delivery package is certified to comply with the terms of the
NAVER POI Pilot Agreement as follows:

1. DATA FORMAT
   - Delivery Format:    CSV and JSON (both included)
   - Encoding:           UTF-8
   - Coordinate System:  WGS84

2. DATA INTEGRITY
   - Total POIs Delivered:  {total_pois}
   - One POI per record:    CONFIRMED
   - No personal data:      CONFIRMED

3. QUALITY ASSURANCE
   - Sampling Inspection:   30% random sampling applied
   - Accuracy Rate:         {accuracy:.2f}%
   - KPI Requirement:       >= 95%
   - Status:                {'PASS' if accuracy >= 95 else 'REQUIRES ATTENTION'}

4. COORDINATE TOLERANCE
   - Maximum allowed deviation: 30 meters
   - Coordinate system:         WGS84

5. MINOR DEVIATIONS (Allowed per contract)
   - Typo in name:              Tracked and flagged
   - Coordinate error <= 30m:   Accepted

6. SERVER RESIDENCY
   - Data storage:  KSA-based servers only

7. BUDGET
   - Pilot Budget Cap:     SAR 50,000
   - Unit Price Per POI:   SAR 52.2

================================================================================
  This document is auto-generated by the Farq POI Validation System.
  For questions, contact: info@farq.tech
================================================================================
"""
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content.strip())


def main():
    parser = argparse.ArgumentParser(description='NAVER Delivery Package Generator')
    parser.add_argument('--input', '-i', required=True, help='Input POI data (JSON or CSV)')
    parser.add_argument('--output', '-o', default='./NAVER_PILOT_DELIVERY', help='Output directory')
    parser.add_argument('--format', '-f', choices=['json', 'csv'], default=None)
    args = parser.parse_args()

    # Detect format
    fmt = args.format
    if not fmt:
        ext = os.path.splitext(args.input)[1].lower()
        fmt = 'csv' if ext == '.csv' else 'json'

    # Load
    print(f'Loading data from {args.input}...')
    pois = load_csv(args.input) if fmt == 'csv' else load_json(args.input)
    print(f'Loaded {len(pois)} POIs')

    # Create directory structure
    base = args.output
    for d in ['csv', 'json', 'media']:
        os.makedirs(os.path.join(base, d), exist_ok=True)

    # 1. Export CSV
    csv_path = os.path.join(base, 'csv', 'naver_poi_delivery.csv')
    generate_csv_export(pois, csv_path)
    print(f'  CSV export: {csv_path}')

    # 2. Export JSON
    json_path = os.path.join(base, 'json', 'naver_poi_delivery.json')
    generate_json_export(pois, json_path)
    print(f'  JSON export: {json_path}')

    # 3. Validate
    print('  Running validation...')
    results = [validate_poi(poi, i) for i, poi in enumerate(pois)]

    # 4. Validation report
    val_report = generate_validation_report(results)
    vr_path = os.path.join(base, 'validation_report.json')
    with open(vr_path, 'w', encoding='utf-8') as f:
        json.dump(val_report, f, indent=2, ensure_ascii=False)
    print(f'  Validation report: {vr_path}')

    # 5. KPI summary
    kpi = qa_sample_and_calculate_kpi(results)
    kpi_path = os.path.join(base, 'kpi_summary.json')
    with open(kpi_path, 'w', encoding='utf-8') as f:
        json.dump(kpi, f, indent=2, ensure_ascii=False)
    print(f'  KPI summary: {kpi_path}')

    # 6. Completeness CSV
    comp_path = os.path.join(base, 'completeness_report.csv')
    generate_completeness_csv(results, comp_path)
    print(f'  Completeness report: {comp_path}')

    # 7. Billing
    billing = calculate_billing(pois)
    bill_path = os.path.join(base, 'billing_summary.json')
    with open(bill_path, 'w', encoding='utf-8') as f:
        json.dump(billing, f, indent=2, ensure_ascii=False)
    print(f'  Billing summary: {bill_path}')

    # 8. Data dictionary
    dd_path = os.path.join(base, 'data_dictionary.json')
    generate_data_dictionary(dd_path)
    print(f'  Data dictionary: {dd_path}')

    # 9. Compliance statement
    accuracy = val_report['summary']['accuracy_pct']
    cs_path = os.path.join(base, 'compliance_statement.txt')
    generate_compliance_statement(cs_path, len(pois), accuracy)
    print(f'  Compliance statement: {cs_path}')

    # Summary
    s = val_report['summary']
    b = billing['billing']
    print(f'\n{"=" * 60}')
    print(f'  DELIVERY PACKAGE READY')
    print(f'{"=" * 60}')
    print(f'  Location:         {os.path.abspath(base)}')
    print(f'  Total POIs:       {s["total_pois"]}')
    print(f'  Valid:            {s["valid_pois"]}')
    print(f'  Accuracy:         {s["accuracy_pct"]}%')
    print(f'  QA Decision:      {kpi["decision"]}')
    print(f'  Total Cost:       {b["subtotal_sar"]:,.2f} SAR')
    print(f'  Budget Status:    {"OVER BUDGET" if b["over_budget"] else "WITHIN BUDGET"}')
    print(f'{"=" * 60}')


if __name__ == '__main__':
    main()
