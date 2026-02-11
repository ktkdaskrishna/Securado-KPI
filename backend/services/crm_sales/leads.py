# ==================== LEADS ====================

@leads_router.get("")
async def list_leads(
    request: Request,
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    stage: Optional[str] = None,
    year: Optional[str] = Query(None, description="Filter by year (e.g., 2024, 2025, 2026)"),
    quarter: Optional[str] = Query(None, description="Filter by quarter (Q1, Q2, Q3, Q4)"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """List leads (type=lead) with overrides applied and optional filters (RBAC enforced)"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    logger.info(f"Leads list request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query with RBAC - ONLY type=lead (exclude opportunities)
    query = {
        "org_id": current_user.get("org_id", "default"),
        "type": "lead"  # Filter to only leads
    }
    query.update(rbac_filter)  # Apply RBAC filter
    
    # Apply non-date filters
    if stage:
        query["stage"] = stage
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    
    # Get from canonical - get more records if filtering
    fetch_limit = limit * 10 if (year or quarter) else limit
    records = await canonical_db.opportunities.find(query).skip(skip).limit(fetch_limit).to_list(fetch_limit)
    
    # Apply date-based filters
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    # Trim to requested limit
    records = records[:limit]
    
    logger.info(f"After filtering: {len(records)} leads")
    
    # Merge with overrides
    merged = await merge_with_overrides(records, current_user.get("org_id", "default"), app_db)
    
    return merged


@leads_router.get("/kanban")
async def leads_kanban(
    request: Request,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    account: Optional[str] = Query(None, description="Filter by account name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """Get leads (type=lead) organized by stage for kanban view (RBAC enforced)"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    org_id = current_user.get("org_id", "default")
    
    logger.info(f"Leads Kanban request - year: {year}, quarter: {quarter}, sales_rep: {sales_rep}")
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query - ONLY type=lead with RBAC
    query = {
        "org_id": org_id,
        "type": "lead"
    }
    query.update(rbac_filter)  # Apply RBAC filter
    
    if sales_rep:
        query["owner_name"] = sales_rep
    if team_id:
        query["team_id"] = team_id
    if account:
        query["account_name"] = account
    
    # Get all leads
    records = await canonical_db.opportunities.find(query).to_list(1000)
    
    # Apply date filters
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    logger.info(f"Leads Kanban after filtering: {len(records)} leads")
    
    # Merge with overrides
    merged = await merge_with_overrides(records, org_id, app_db)
    
    # Lead stages - different from opportunity stages
    lead_stages = ["new", "qualified", "proposition", "won", "lost"]
    
    # Organize by stage
    kanban = {stage: [] for stage in lead_stages}
    kanban["unknown"] = []
    
    for record in merged:
        stage = (record.get("stage", "unknown") or "unknown").lower()
        # Normalize stage names
        if "new" in stage or "enquiry" in stage:
            kanban["new"].append(record)
        elif "qualified" in stage or "qualification" in stage:
            kanban["qualified"].append(record)
        elif "proposition" in stage or "proposal" in stage:
            kanban["proposition"].append(record)
        elif "won" in stage:
            kanban["won"].append(record)
        elif "lost" in stage:
            kanban["lost"].append(record)
        else:
            kanban["unknown"].append(record)
    
    return {
        "stages": lead_stages,
        "data": kanban,
        "filtered": any([year, quarter, sales_rep, team_id, account]),
        "total_count": len(merged)
    }


@leads_router.get("/stats")
async def leads_stats(
    request: Request,
    year: Optional[str] = Query(None, description="Filter by year"),
    quarter: Optional[str] = Query(None, description="Filter by quarter"),
    sales_rep: Optional[str] = Query(None, description="Filter by sales rep name"),
    date_field: Optional[str] = Query('create_date', description="Date field to filter on"),
    current_user: dict = Depends(get_current_user)
):
    """Get leads statistics (RBAC enforced)"""
    canonical_db = get_canonical_db()
    org_id = current_user.get("org_id", "default")
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query - ONLY type=lead with RBAC
    query = {
        "org_id": org_id,
        "type": "lead"
    }
    query.update(rbac_filter)  # Apply RBAC filter
    
    if sales_rep:
        query["owner_name"] = sales_rep
    
    # Get all leads
    records = await canonical_db.opportunities.find(query).to_list(10000)
    
    # Apply date filters
    records = apply_date_filters(records, year=year, quarter=quarter, date_field=date_field or 'create_date')
    
    # Calculate stats
    total_leads = len(records)
    total_value = sum(r.get("amount", 0) or 0 for r in records)
    
    # By stage - leads are typically in: Enquiry, Qualified Opportunity
    new_leads = len([r for r in records if "new" in (r.get("stage") or "").lower() or "enquiry" in (r.get("stage") or "").lower()])
    qualified_leads = len([r for r in records if "qualified" in (r.get("stage") or "").lower()])
    converted_leads = len([r for r in records if "won" in (r.get("stage") or "").lower()])
    lost_leads = len([r for r in records if "lost" in (r.get("stage") or "").lower()])
    
    # Conversion rate for leads = Qualified / Total (leads become "Qualified" before converting to opportunities)
    # If no qualified leads but have won, use won count
    converted_count = qualified_leads if qualified_leads > 0 else converted_leads
    conversion_rate = (converted_count / total_leads * 100) if total_leads > 0 else 0
    
    return {
        "total_leads": total_leads,
        "total_value": total_value,
        "new_leads": new_leads,
        "qualified_leads": qualified_leads,
        "converted_leads": converted_leads,
        "lost_leads": lost_leads,
        "conversion_rate": round(conversion_rate, 1),
        "filtered": any([year, quarter, sales_rep])
    }


@leads_router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get single lead with overrides (RBAC enforced)"""
    canonical_db = get_canonical_db()
    app_db = get_app_db()
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query with RBAC
    query = {
        "canonical_id": lead_id,
        "org_id": current_user.get("org_id", "default"),
        "type": "lead"
    }
    query.update(rbac_filter)  # Apply RBAC filter
    
    record = await canonical_db.opportunities.find_one(query)
    
    if not record:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    merged = await merge_with_overrides([record], current_user.get("org_id", "default"), app_db)
    return merged[0]


@leads_router.post("/{lead_id}/convert")
async def convert_lead_to_opportunity(
    lead_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Convert a lead to an opportunity (RBAC enforced)"""
    canonical_db = get_canonical_db()
    
    # Get RBAC filter - CRITICAL for security
    rbac_filter = await get_rbac_filter(request, current_user, "opportunity")
    
    # Build query with RBAC
    query = {
        "canonical_id": lead_id,
        "org_id": current_user.get("org_id", "default"),
        "type": "lead"
    }
    query.update(rbac_filter)  # Apply RBAC filter
    
    # Get the lead
    lead = await canonical_db.opportunities.find_one(query)
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update the type to opportunity
    await canonical_db.opportunities.update_one(
        {"canonical_id": lead_id},
        {"$set": {"type": "opportunity", "updated_at": now_utc()}}
    )
    
    logger.info(f"Lead {lead_id} converted to opportunity")
    
    return {
        "success": True,
        "message": "Lead converted to opportunity",
        "lead_id": lead_id
    }


