"""Microsoft OAuth/Azure AD SSO Authentication Service

This service handles:
- Microsoft OAuth2 authorization flow
- Token validation and user info extraction
- Auto-linking Microsoft users to RBAC profiles by email

Configuration required in .env:
- MICROSOFT_CLIENT_ID: Azure AD Application (client) ID
- MICROSOFT_CLIENT_SECRET: Azure AD Client secret (for confidential client)
- MICROSOFT_TENANT_ID: Azure AD Directory (tenant) ID
- MICROSOFT_REDIRECT_URI: OAuth redirect URI (must match Azure AD config)
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
import os
import jwt
import httpx
import logging
import secrets
import hashlib
import base64

from libs.database import get_app_db
from libs.utils import generate_id, now_utc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/microsoft", tags=["microsoft-auth"])

# Configuration from environment variables
MICROSOFT_CLIENT_ID = os.environ.get("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.environ.get("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_TENANT_ID = os.environ.get("MICROSOFT_TENANT_ID", "")
MICROSOFT_REDIRECT_URI = os.environ.get("MICROSOFT_REDIRECT_URI", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")

# Azure AD OAuth endpoints
AUTHORITY = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}" if MICROSOFT_TENANT_ID else ""
AUTHORIZE_URL = f"{AUTHORITY}/oauth2/v2.0/authorize" if AUTHORITY else ""
TOKEN_URL = f"{AUTHORITY}/oauth2/v2.0/token" if AUTHORITY else ""
GRAPH_URL = "https://graph.microsoft.com/v1.0/me"

# OAuth scopes
SCOPES = ["openid", "profile", "email", "User.Read"]

# Store state tokens temporarily (in production, use Redis)
_state_store: Dict[str, Dict[str, Any]] = {}

# Runtime config cache (loaded from DB)
_runtime_config: Dict[str, str] = {}


async def load_config_from_db():
    """Load SSO config from database if not set in environment"""
    global _runtime_config, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, MICROSOFT_REDIRECT_URI
    global AUTHORITY, AUTHORIZE_URL, TOKEN_URL
    
    app_db = get_app_db()
    config = await app_db.system_config.find_one({"config_type": "microsoft_sso"})
    
    if config:
        _runtime_config = config.get("settings", {})
        
        # Only override if not set in environment
        if not os.environ.get("MICROSOFT_CLIENT_ID") and _runtime_config.get("client_id"):
            MICROSOFT_CLIENT_ID = _runtime_config.get("client_id", "")
        if not os.environ.get("MICROSOFT_CLIENT_SECRET") and _runtime_config.get("client_secret"):
            MICROSOFT_CLIENT_SECRET = _runtime_config.get("client_secret", "")
        if not os.environ.get("MICROSOFT_TENANT_ID") and _runtime_config.get("tenant_id"):
            MICROSOFT_TENANT_ID = _runtime_config.get("tenant_id", "")
        if not os.environ.get("MICROSOFT_REDIRECT_URI") and _runtime_config.get("redirect_uri"):
            MICROSOFT_REDIRECT_URI = _runtime_config.get("redirect_uri", "")
        
        # Update derived URLs
        if MICROSOFT_TENANT_ID:
            AUTHORITY = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}"
            AUTHORIZE_URL = f"{AUTHORITY}/oauth2/v2.0/authorize"
            TOKEN_URL = f"{AUTHORITY}/oauth2/v2.0/token"


def is_microsoft_auth_configured() -> bool:
    """Check if Microsoft auth is properly configured"""
    return bool(MICROSOFT_CLIENT_ID and MICROSOFT_TENANT_ID and MICROSOFT_REDIRECT_URI)


@router.get("/status")
async def microsoft_auth_status():
    """Check Microsoft SSO configuration status"""
    # Try to load from DB first
    await load_config_from_db()
    
    configured = is_microsoft_auth_configured()
    return {
        "configured": configured,
        "client_id_set": bool(MICROSOFT_CLIENT_ID),
        "tenant_id_set": bool(MICROSOFT_TENANT_ID),
        "redirect_uri_set": bool(MICROSOFT_REDIRECT_URI),
        "client_secret_set": bool(MICROSOFT_CLIENT_SECRET),
        "message": "Microsoft SSO is ready" if configured else "Microsoft SSO not configured. Configure in Settings → SSO."
    }


@router.get("/config")
async def get_frontend_config():
    """Get Microsoft auth configuration for frontend (safe to expose)"""
    await load_config_from_db()
    
    return {
        "clientId": MICROSOFT_CLIENT_ID,
        "tenantId": MICROSOFT_TENANT_ID,
        "redirectUri": MICROSOFT_REDIRECT_URI,
        "authority": AUTHORITY,
        "scopes": SCOPES,
        "configured": is_microsoft_auth_configured()
    }


@router.get("/admin/config")
async def get_admin_config():
    """Get full SSO config for admin (requires auth)"""
    app_db = get_app_db()
    config = await app_db.system_config.find_one({"config_type": "microsoft_sso"})
    
    if config:
        settings = config.get("settings", {})
        # Mask the client secret
        if settings.get("client_secret"):
            settings["client_secret_masked"] = "••••••••" + settings["client_secret"][-4:] if len(settings.get("client_secret", "")) > 4 else "••••••••"
            settings["client_secret"] = ""  # Don't expose full secret
        return {
            "configured": is_microsoft_auth_configured(),
            "settings": settings,
            "updated_at": config.get("updated_at")
        }
    
    return {
        "configured": False,
        "settings": {
            "client_id": "",
            "tenant_id": "",
            "redirect_uri": "",
            "client_secret_masked": ""
        },
        "updated_at": None
    }


@router.post("/admin/config")
async def save_admin_config(request: Request):
    """Save SSO configuration (admin only)"""
    global MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, MICROSOFT_REDIRECT_URI
    global AUTHORITY, AUTHORIZE_URL, TOKEN_URL
    
    app_db = get_app_db()
    body = await request.json()
    
    # Get existing config to preserve client_secret if not provided
    existing = await app_db.system_config.find_one({"config_type": "microsoft_sso"})
    existing_settings = existing.get("settings", {}) if existing else {}
    
    # Build new settings
    new_settings = {
        "client_id": body.get("client_id", "").strip(),
        "tenant_id": body.get("tenant_id", "").strip(),
        "redirect_uri": body.get("redirect_uri", "").strip(),
    }
    
    # Only update client_secret if provided (non-empty)
    if body.get("client_secret", "").strip():
        new_settings["client_secret"] = body.get("client_secret", "").strip()
    elif existing_settings.get("client_secret"):
        new_settings["client_secret"] = existing_settings["client_secret"]
    
    # Save to database
    await app_db.system_config.update_one(
        {"config_type": "microsoft_sso"},
        {
            "$set": {
                "config_type": "microsoft_sso",
                "settings": new_settings,
                "updated_at": now_utc()
            }
        },
        upsert=True
    )
    
    # Update runtime config
    MICROSOFT_CLIENT_ID = new_settings.get("client_id", "")
    MICROSOFT_CLIENT_SECRET = new_settings.get("client_secret", "")
    MICROSOFT_TENANT_ID = new_settings.get("tenant_id", "")
    MICROSOFT_REDIRECT_URI = new_settings.get("redirect_uri", "")
    
    # Update derived URLs
    if MICROSOFT_TENANT_ID:
        AUTHORITY = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}"
        AUTHORIZE_URL = f"{AUTHORITY}/oauth2/v2.0/authorize"
        TOKEN_URL = f"{AUTHORITY}/oauth2/v2.0/token"
    
    logger.info(f"Microsoft SSO config updated: client_id={bool(MICROSOFT_CLIENT_ID)}, tenant_id={bool(MICROSOFT_TENANT_ID)}")
    
    return {
        "success": True,
        "configured": is_microsoft_auth_configured(),
        "message": "Microsoft SSO configuration saved successfully"
    }


def generate_pkce_pair():
    """Generate PKCE code_verifier and code_challenge pair for OAuth 2.0 security"""
    # Generate a random code_verifier (43-128 characters)
    code_verifier = secrets.token_urlsafe(64)
    
    # Generate code_challenge using S256 method (SHA256 hash, base64url encoded)
    code_challenge_bytes = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    code_challenge = base64.urlsafe_b64encode(code_challenge_bytes).rstrip(b'=').decode('utf-8')
    
    return code_verifier, code_challenge


@router.get("/login")
async def microsoft_login(redirect_to: Optional[str] = "/"):
    """Initiate Microsoft OAuth login flow with PKCE support"""
    if not is_microsoft_auth_configured():
        raise HTTPException(
            status_code=503, 
            detail="Microsoft SSO not configured. Please set MICROSOFT_CLIENT_ID, MICROSOFT_TENANT_ID, and MICROSOFT_REDIRECT_URI in environment variables."
        )
    
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Generate PKCE pair for enhanced security (required by Azure AD)
    code_verifier, code_challenge = generate_pkce_pair()
    
    # Store state with PKCE verifier for callback validation
    _state_store[state] = {
        "redirect_to": redirect_to,
        "code_verifier": code_verifier,  # Store verifier to use in token exchange
        "created_at": datetime.now(timezone.utc)
    }
    
    # Build authorization URL with PKCE parameters
    params = {
        "client_id": MICROSOFT_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": MICROSOFT_REDIRECT_URI,
        "response_mode": "query",
        "scope": " ".join(SCOPES),
        "state": state,
        "prompt": "select_account",  # Always show account picker
        "code_challenge": code_challenge,
        "code_challenge_method": "S256"
    }
    
    auth_url = f"{AUTHORIZE_URL}?{urlencode(params)}"
    logger.info(f"Redirecting to Microsoft login with PKCE: {auth_url[:100]}...")
    
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def microsoft_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None
):
    """Handle Microsoft OAuth callback"""
    app_db = get_app_db()
    
    # Handle errors from Microsoft
    if error:
        logger.error(f"Microsoft OAuth error: {error} - {error_description}")
        # Redirect to frontend with error
        return RedirectResponse(url=f"/login?error={error}&message={error_description}")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")
    
    # Validate state token
    state_data = _state_store.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state token")
    
    redirect_to = state_data.get("redirect_to", "/")
    code_verifier = state_data.get("code_verifier")  # Retrieve PKCE verifier
    
    try:
        # Exchange code for tokens (with PKCE code_verifier for security)
        async with httpx.AsyncClient() as client:
            token_data = {
                "client_id": MICROSOFT_CLIENT_ID,
                "client_secret": MICROSOFT_CLIENT_SECRET,
                "code": code,
                "redirect_uri": MICROSOFT_REDIRECT_URI,
                "grant_type": "authorization_code",
                "scope": " ".join(SCOPES)
            }
            
            # Include PKCE code_verifier if available (required by Azure AD)
            if code_verifier:
                token_data["code_verifier"] = code_verifier
            
            token_response = await client.post(
                TOKEN_URL,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange code for tokens")
            
            tokens = token_response.json()
            access_token = tokens.get("access_token")
            id_token = tokens.get("id_token")
            
            # Get user info from Microsoft Graph
            user_response = await client.get(
                GRAPH_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                logger.error(f"Failed to get user info: {user_response.text}")
                raise HTTPException(status_code=400, detail="Failed to get user information")
            
            ms_user = user_response.json()
        
        # Extract user info
        email = ms_user.get("mail") or ms_user.get("userPrincipalName", "").lower()
        display_name = ms_user.get("displayName", "")
        ms_id = ms_user.get("id", "")
        
        logger.info(f"Microsoft user authenticated: {email} ({display_name})")
        
        # Auto-link to RBAC by email
        rbac_user = await app_db.users_rbac.find_one({
            "$or": [
                {"email": {"$regex": f"^{email}$", "$options": "i"}},
                {"login": {"$regex": f"^{email}$", "$options": "i"}}
            ]
        })
        
        # Find or create local user
        local_user = await app_db.users.find_one({
            "$or": [
                {"microsoft_id": ms_id},
                {"email": {"$regex": f"^{email}$", "$options": "i"}}
            ]
        })
        
        if local_user:
            # Update existing user with Microsoft info
            await app_db.users.update_one(
                {"_id": local_user["_id"]},
                {
                    "$set": {
                        "microsoft_id": ms_id,
                        "display_name": display_name,
                        "last_login": now_utc(),
                        "auth_provider": "microsoft",
                        "rbac_linked": bool(rbac_user),
                        "rbac_user_id": rbac_user.get("odoo_user_id") if rbac_user else None
                    }
                }
            )
            user_id = str(local_user["_id"])
            org_id = local_user.get("org_id", "default")
        else:
            # Create new user
            user_id = generate_id()
            org_id = "default"
            
            new_user = {
                "_id": user_id,
                "id": user_id,
                "email": email,
                "display_name": display_name,
                "microsoft_id": ms_id,
                "auth_provider": "microsoft",
                "org_id": org_id,
                "role": "user",
                "permissions": ["view_dashboard", "manage_leads", "manage_opportunities"],
                "rbac_linked": bool(rbac_user),
                "rbac_user_id": rbac_user.get("odoo_user_id") if rbac_user else None,
                "created_at": now_utc(),
                "last_login": now_utc()
            }
            
            await app_db.users.insert_one(new_user)
        
        # Determine access level from RBAC
        access_level = "RESTRICTED"
        rbac_groups = []
        rbac_teams = []
        
        if rbac_user:
            rbac_groups = rbac_user.get("odoo_group_names", [])
            rbac_teams = rbac_user.get("odoo_team_names", [])
            
            # Determine access level
            sales_admin_groups = ["Sales / Administrator", "Administration / Settings"]
            sales_manager_groups = ["Sales / Manager"]
            sales_user_groups = ["Sales / User", "Sales / Salesperson"]
            
            if any(g in rbac_groups for g in sales_admin_groups):
                access_level = "ADMIN"
            elif any(g in rbac_groups for g in sales_manager_groups):
                access_level = "MANAGER"
            elif any(g in rbac_groups for g in sales_user_groups):
                access_level = "USER"
        
        # Generate JWT token for the app
        token_payload = {
            "sub": user_id,
            "email": email,
            "name": display_name,
            "org_id": org_id,
            "microsoft_id": ms_id,
            "rbac_linked": bool(rbac_user),
            "access_level": access_level,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        }
        
        app_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        
        # Redirect to frontend with token
        # Frontend will store this token and use it for API calls
        redirect_url = f"{redirect_to}?token={app_token}&provider=microsoft"
        
        logger.info(f"Microsoft SSO complete for {email}, access_level={access_level}, rbac_linked={bool(rbac_user)}")
        
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        logger.error(f"Microsoft OAuth callback error: {e}")
        return RedirectResponse(url=f"/login?error=auth_failed&message={str(e)}")


@router.post("/token-login")
async def microsoft_token_login(request: Request):
    """
    Alternative: Login with Microsoft ID token from frontend MSAL
    Frontend can use MSAL.js to get tokens directly, then send to backend for validation
    """
    app_db = get_app_db()
    
    try:
        body = await request.json()
        id_token = body.get("id_token")
        access_token = body.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Missing access_token")
        
        # Get user info from Microsoft Graph using the access token
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                GRAPH_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Microsoft access token")
            
            ms_user = user_response.json()
        
        # Extract user info
        email = ms_user.get("mail") or ms_user.get("userPrincipalName", "").lower()
        display_name = ms_user.get("displayName", "")
        ms_id = ms_user.get("id", "")
        
        # Auto-link to RBAC by email
        rbac_user = await app_db.users_rbac.find_one({
            "$or": [
                {"email": {"$regex": f"^{email}$", "$options": "i"}},
                {"login": {"$regex": f"^{email}$", "$options": "i"}},
                {"name": {"$regex": f"^{display_name}$", "$options": "i"}}
            ]
        })
        
        # Find or create local user
        local_user = await app_db.users.find_one({
            "$or": [
                {"microsoft_id": ms_id},
                {"email": {"$regex": f"^{email}$", "$options": "i"}}
            ]
        })
        
        if local_user:
            await app_db.users.update_one(
                {"_id": local_user["_id"]},
                {
                    "$set": {
                        "microsoft_id": ms_id,
                        "display_name": display_name,
                        "last_login": now_utc(),
                        "auth_provider": "microsoft",
                        "rbac_linked": bool(rbac_user),
                        "rbac_user_id": rbac_user.get("odoo_user_id") if rbac_user else None
                    }
                }
            )
            user_id = str(local_user["_id"])
            org_id = local_user.get("org_id", "default")
            permissions = local_user.get("permissions", [])
        else:
            user_id = generate_id()
            org_id = "default"
            permissions = ["view_dashboard", "manage_leads", "manage_opportunities"]
            
            new_user = {
                "_id": user_id,
                "id": user_id,
                "email": email,
                "display_name": display_name,
                "microsoft_id": ms_id,
                "auth_provider": "microsoft",
                "org_id": org_id,
                "role": "user",
                "permissions": permissions,
                "rbac_linked": bool(rbac_user),
                "rbac_user_id": rbac_user.get("odoo_user_id") if rbac_user else None,
                "created_at": now_utc(),
                "last_login": now_utc()
            }
            
            await app_db.users.insert_one(new_user)
        
        # Determine access level from RBAC
        access_level = "RESTRICTED"
        if rbac_user:
            rbac_groups = rbac_user.get("odoo_group_names", [])
            sales_admin_groups = ["Sales / Administrator", "Administration / Settings"]
            sales_manager_groups = ["Sales / Manager"]
            sales_user_groups = ["Sales / User", "Sales / Salesperson"]
            
            if any(g in rbac_groups for g in sales_admin_groups):
                access_level = "ADMIN"
            elif any(g in rbac_groups for g in sales_manager_groups):
                access_level = "MANAGER"
            elif any(g in rbac_groups for g in sales_user_groups):
                access_level = "USER"
        
        # Generate app JWT
        token_payload = {
            "sub": user_id,
            "email": email,
            "name": display_name,
            "org_id": org_id,
            "microsoft_id": ms_id,
            "rbac_linked": bool(rbac_user),
            "access_level": access_level,
            "permissions": permissions,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        }
        
        app_token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        
        return {
            "access_token": app_token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "display_name": display_name,
                "org_id": org_id,
                "rbac_linked": bool(rbac_user),
                "access_level": access_level,
                "permissions": permissions
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Microsoft token login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-rbac-status")
async def get_user_rbac_status(email: str):
    """Check if an email is linked to an RBAC profile"""
    app_db = get_app_db()
    
    rbac_user = await app_db.users_rbac.find_one({
        "$or": [
            {"email": {"$regex": f"^{email}$", "$options": "i"}},
            {"login": {"$regex": f"^{email}$", "$options": "i"}}
        ]
    })
    
    if rbac_user:
        return {
            "linked": True,
            "odoo_user_name": rbac_user.get("name"),
            "access_level": rbac_user.get("access_level", "USER"),
            "teams": rbac_user.get("odoo_team_names", []),
            "groups_count": len(rbac_user.get("odoo_group_names", []))
        }
    
    return {
        "linked": False,
        "message": "No RBAC profile found for this email. User will have restricted access."
    }
