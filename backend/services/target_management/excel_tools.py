"""Excel Export/Import for Field Mappings and Data Correction"""
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional
import io
import logging

from libs.database import get_app_db, get_canonical_db
from libs.utils import serialize_doc, generate_id, now_utc
from services.identity.routes import get_current_user

logger = logging.getLogger(__name__)
excel_router = APIRouter(prefix="/data-tools", tags=["data-tools"])


@excel_router.get("/mappings/download")
async def download_field_mappings(current_user: dict = Depends(get_current_user)):
    """Download current field mappings as Excel"""
    import openpyxl
    app_db = get_app_db()

    wb = openpyxl.Workbook()

    # Sheet 1: Mapping Summary
    ws1 = wb.active
    ws1.title = "Mapping Summary"
    ws1.append(["Mapping Name", "Source Model", "Target Entity", "Fields Count", "Connection", "Version", "Status"])

    mappings = await app_db.mappings.find({}, {"_id": 0}).to_list(50)
    for m in mappings:
        ws1.append([
            m.get("name"), m.get("source_model"), m.get("target_entity"),
            len(m.get("field_mappings", [])), m.get("connection_id", "")[:8],
            m.get("version", 1), m.get("status", "active")
        ])

    # Sheet 2: Field Details (all mappings)
    ws2 = wb.create_sheet("Field Mappings")
    ws2.append(["Mapping Name", "Source Field (Odoo)", "Target Field (CRM)", "Transform", "Required", "Default Value"])

    for m in mappings:
        for fm in m.get("field_mappings", []):
            ws2.append([
                m.get("name"),
                fm.get("source_field") or fm.get("source"),
                fm.get("target_field") or fm.get("target"),
                fm.get("transform", ""),
                fm.get("required", False),
                fm.get("default_value", "")
            ])

    # Sheet 3: Canonical Schema
    ws3 = wb.create_sheet("Canonical Schema")
    ws3.append(["Collection", "Field Name", "Sample Value", "Data Type"])

    canonical_db = get_canonical_db()
    for coll_name in ["opportunities", "accounts", "activities", "invoices", "employees"]:
        sample = await canonical_db[coll_name].find_one({}, {"_id": 0})
        if sample:
            for key, value in sorted(sample.items()):
                dtype = type(value).__name__ if value is not None else "null"
                sample_val = str(value)[:100] if value is not None else ""
                ws3.append([coll_name, key, sample_val, dtype])

    # Sheet 4: User Identity Map
    ws4 = wb.create_sheet("User Identity Map")
    ws4.append(["Email", "Canonical Name", "Display Name", "All Name Variants", "Active"])

    async for u in app_db.user_identity_map.find({}, {"_id": 0}).sort("email", 1):
        ws4.append([
            u.get("email"), u.get("canonical_name"), u.get("display_name"),
            " | ".join(u.get("all_names", [])), u.get("active", True)
        ])

    # Style headers
    from openpyxl.styles import Font, PatternFill
    header_fill = PatternFill(start_color="800000", end_color="800000", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for ws in [ws1, ws2, ws3, ws4]:
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
        # Auto-width
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=securado_field_mappings.xlsx"}
    )


@excel_router.get("/data-template/download")
async def download_data_template(
    entity: str = "opportunities",
    current_user: dict = Depends(get_current_user)
):
    """Download data correction template with current data"""
    import openpyxl
    canonical_db = get_canonical_db()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"{entity} Data"

    # Get records
    records = await canonical_db[entity].find(
        {"deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("create_date", -1).limit(2000).to_list(2000)

    if not records:
        ws.append(["No data found"])
    else:
        # Key fields per entity
        key_fields = {
            "opportunities": ["canonical_id", "source_record_id", "name", "account_name", "owner_name",
                "product_manager", "solution_category", "stage", "custom_stage",
                "sale_value", "x_studio_sale_value", "amount", "sale_amount_total",
                "probability", "type", "active", "create_date", "date_closed", "date_deadline"],
            "accounts": ["canonical_id", "source_record_id", "name", "email", "phone", "owner_name",
                "city", "country_id", "active", "total_invoiced", "credit", "debit"],
            "invoices": ["canonical_id", "source_record_id", "invoice_number", "account_name",
                "amount_total", "amount_residual", "payment_state", "invoice_date", "due_date"],
            "activities": ["canonical_id", "source_record_id", "activity_type", "assigned_user",
                "subject", "status", "due_date", "opportunity_id"],
            "employees": ["canonical_id", "source_record_id", "name", "email", "job_title",
                "department_name", "active", "manager_id"],
        }

        fields = key_fields.get(entity, list(records[0].keys())[:20])

        # Header row
        ws.append(fields)

        # Data rows
        for rec in records:
            row = []
            for f in fields:
                val = rec.get(f)
                if isinstance(val, (list, dict)):
                    val = str(val)
                row.append(val)
            ws.append(row)

        # Instructions sheet
        ws2 = wb.create_sheet("Instructions")
        ws2.append(["Data Correction Instructions"])
        ws2.append([""])
        ws2.append(["1. Edit values in the data sheet (do NOT change canonical_id or source_record_id)"])
        ws2.append(["2. Add new rows at the bottom if needed"])
        ws2.append(["3. Save the file and upload via the Data Tools > Upload Corrections endpoint"])
        ws2.append(["4. The system will UPSERT: update existing records by source_record_id, insert new ones"])
        ws2.append([""])
        ws2.append(["Color coding:"])
        ws2.append(["  Green = editable fields"])
        ws2.append(["  Red = system fields (do not edit)"])

    # Style
    from openpyxl.styles import Font, PatternFill
    header_fill = PatternFill(start_color="800000", end_color="800000", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=securado_{entity}_template.xlsx"}
    )


@excel_router.post("/data-template/upload")
async def upload_data_corrections(
    file: UploadFile = File(...),
    entity: str = "opportunities",
    current_user: dict = Depends(get_current_user)
):
    """Upload corrected data Excel file - upserts into canonical DB"""
    import openpyxl
    canonical_db = get_canonical_db()

    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    # Read header
    headers = [cell.value for cell in ws[1]]
    if not headers or "source_record_id" not in headers:
        return {"success": False, "error": "Invalid template - missing source_record_id column"}

    updated = 0
    inserted = 0
    errors = []

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        record = {}
        for col_idx, value in enumerate(row):
            if col_idx < len(headers) and headers[col_idx]:
                record[headers[col_idx]] = value

        source_id = str(record.get("source_record_id", ""))
        if not source_id:
            continue

        # Remove None values
        record = {k: v for k, v in record.items() if v is not None}
        record["updated_at"] = now_utc()
        record["updated_by"] = current_user.get("name", "system")

        try:
            result = await canonical_db[entity].update_one(
                {"source_record_id": source_id},
                {"$set": record},
                upsert=True
            )
            if result.modified_count > 0:
                updated += 1
            elif result.upserted_id:
                inserted += 1
        except Exception as e:
            errors.append(f"Row {row_idx}: {str(e)[:100]}")

    return {
        "success": True,
        "updated": updated,
        "inserted": inserted,
        "total_rows": row_idx - 1,
        "errors": errors[:10]
    }
