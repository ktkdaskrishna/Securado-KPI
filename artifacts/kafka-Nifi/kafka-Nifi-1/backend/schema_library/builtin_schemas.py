"""Built-in Canonical Schemas - Pre-defined data models"""
from .models import (
    SchemaDefinition, FieldDefinition, RelationshipDefinition,
    IndexDefinition, SchemaCategory, IndustryType, DataType,
    RelationshipType, IndexType
)
from typing import Dict, Optional, List


# ==================== CANONICAL SCHEMAS ====================

OPPORTUNITY_SCHEMA = SchemaDefinition(
    id="canonical_opportunity",
    name="Opportunity",
    display_name="Sales Opportunity",
    version="2.0",
    category=SchemaCategory.CANONICAL,
    description="Standard sales opportunity/deal record for CRM data",
    is_system=True,
    fields=[
        FieldDefinition(
            name="opportunity_id", display_name="Opportunity ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True,
            description="Unique canonical identifier for the opportunity"
        ),
        FieldDefinition(
            name="name", display_name="Opportunity Name",
            data_type=DataType.STRING, required=True, max_length=255,
            description="Name/title of the opportunity"
        ),
        FieldDefinition(
            name="amount", display_name="Deal Amount",
            data_type=DataType.CURRENCY, min_value=0,
            description="Expected revenue/deal value"
        ),
        FieldDefinition(
            name="currency", display_name="Currency",
            data_type=DataType.STRING, max_length=3, default_value="USD",
            enum_values=["USD", "EUR", "GBP", "INR", "AED", "SAR"],
            description="Currency code (ISO 4217)"
        ),
        FieldDefinition(
            name="stage", display_name="Stage",
            data_type=DataType.STRING, max_length=100,
            description="Current pipeline stage"
        ),
        FieldDefinition(
            name="probability", display_name="Win Probability",
            data_type=DataType.NUMBER, min_value=0, max_value=100,
            description="Probability of winning (0-100%)"
        ),
        FieldDefinition(
            name="is_won", display_name="Is Won",
            data_type=DataType.BOOLEAN, default_value=False,
            description="Whether the deal was won"
        ),
        FieldDefinition(
            name="is_closed", display_name="Is Closed",
            data_type=DataType.BOOLEAN, default_value=False,
            description="Whether the deal is closed (won or lost)"
        ),
        FieldDefinition(
            name="expected_close_date", display_name="Expected Close Date",
            data_type=DataType.DATE,
            description="Expected closing date"
        ),
        FieldDefinition(
            name="actual_close_date", display_name="Actual Close Date",
            data_type=DataType.DATE,
            description="Actual closing date"
        ),
        FieldDefinition(
            name="owner_id", display_name="Owner ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="User", references_field="user_id",
            description="ID of the owner/sales rep"
        ),
        FieldDefinition(
            name="owner_name", display_name="Owner Name",
            data_type=DataType.STRING, max_length=255,
            description="Name of the owner/sales rep"
        ),
        FieldDefinition(
            name="owner_email", display_name="Owner Email",
            data_type=DataType.EMAIL,
            description="Email of the owner/sales rep"
        ),
        FieldDefinition(
            name="contact_id", display_name="Primary Contact ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="Contact", references_field="contact_id",
            description="ID of the primary contact"
        ),
        FieldDefinition(
            name="contact_name", display_name="Contact Name",
            data_type=DataType.STRING, max_length=255,
            description="Name of the primary contact"
        ),
        FieldDefinition(
            name="contact_email", display_name="Contact Email",
            data_type=DataType.EMAIL,
            description="Email of the primary contact"
        ),
        FieldDefinition(
            name="contact_phone", display_name="Contact Phone",
            data_type=DataType.PHONE,
            description="Phone number of the primary contact"
        ),
        FieldDefinition(
            name="account_id", display_name="Account ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="Account", references_field="account_id",
            description="ID of the associated account/company"
        ),
        FieldDefinition(
            name="account_name", display_name="Account Name",
            data_type=DataType.STRING, max_length=255,
            description="Name of the associated account/company"
        ),
        FieldDefinition(
            name="source", display_name="Lead Source",
            data_type=DataType.STRING, max_length=100,
            enum_values=["website", "referral", "cold_call", "event", "partner", "other"],
            description="Source of the opportunity"
        ),
        FieldDefinition(
            name="description", display_name="Description",
            data_type=DataType.STRING,
            description="Detailed description of the opportunity"
        ),
        FieldDefinition(
            name="tags", display_name="Tags",
            data_type=DataType.ARRAY,
            description="Tags/labels for categorization"
        ),
        FieldDefinition(
            name="custom_fields", display_name="Custom Fields",
            data_type=DataType.JSON,
            description="Additional custom fields as JSON"
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True,
            description="Record creation timestamp"
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True,
            description="Record last update timestamp"
        ),
    ],
    relationships=[
        RelationshipDefinition(
            name="contact", target_schema="Contact", type=RelationshipType.MANY_TO_ONE,
            local_field="contact_id", foreign_field="contact_id",
            description="Primary contact for this opportunity"
        ),
        RelationshipDefinition(
            name="account", target_schema="Account", type=RelationshipType.MANY_TO_ONE,
            local_field="account_id", foreign_field="account_id",
            description="Associated account/company"
        ),
        RelationshipDefinition(
            name="owner", target_schema="User", type=RelationshipType.MANY_TO_ONE,
            local_field="owner_id", foreign_field="user_id",
            description="Sales rep who owns this opportunity"
        ),
        RelationshipDefinition(
            name="activities", target_schema="Activity", type=RelationshipType.ONE_TO_MANY,
            local_field="opportunity_id", foreign_field="opportunity_id",
            description="Related activities"
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_opp_stage", fields=["stage"], type=IndexType.INDEX),
        IndexDefinition(name="idx_opp_owner", fields=["owner_id"], type=IndexType.INDEX),
        IndexDefinition(name="idx_opp_account", fields=["account_id"], type=IndexType.INDEX),
        IndexDefinition(name="idx_opp_close_date", fields=["expected_close_date"], type=IndexType.INDEX),
    ],
    tags=["crm", "sales", "pipeline"]
)


CONTACT_SCHEMA = SchemaDefinition(
    id="canonical_contact",
    name="Contact",
    display_name="Contact/Person",
    version="1.5",
    category=SchemaCategory.CANONICAL,
    description="Standard contact/person record",
    is_system=True,
    fields=[
        FieldDefinition(
            name="contact_id", display_name="Contact ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True,
            description="Unique canonical identifier"
        ),
        FieldDefinition(
            name="first_name", display_name="First Name",
            data_type=DataType.STRING, max_length=100,
            description="First name"
        ),
        FieldDefinition(
            name="last_name", display_name="Last Name",
            data_type=DataType.STRING, max_length=100,
            description="Last name"
        ),
        FieldDefinition(
            name="full_name", display_name="Full Name",
            data_type=DataType.STRING, required=True, max_length=255,
            description="Full name"
        ),
        FieldDefinition(
            name="email", display_name="Email",
            data_type=DataType.EMAIL,
            description="Primary email address"
        ),
        FieldDefinition(
            name="phone", display_name="Phone",
            data_type=DataType.PHONE,
            description="Primary phone number"
        ),
        FieldDefinition(
            name="mobile", display_name="Mobile",
            data_type=DataType.PHONE,
            description="Mobile phone number"
        ),
        FieldDefinition(
            name="job_title", display_name="Job Title",
            data_type=DataType.STRING, max_length=150,
            description="Job title/position"
        ),
        FieldDefinition(
            name="department", display_name="Department",
            data_type=DataType.STRING, max_length=100,
            description="Department within company"
        ),
        FieldDefinition(
            name="account_id", display_name="Account ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="Account", references_field="account_id",
            description="Associated account/company ID"
        ),
        FieldDefinition(
            name="account_name", display_name="Account Name",
            data_type=DataType.STRING, max_length=255,
            description="Associated account/company name"
        ),
        FieldDefinition(
            name="address_street", display_name="Street Address",
            data_type=DataType.STRING,
            description="Street address"
        ),
        FieldDefinition(
            name="address_city", display_name="City",
            data_type=DataType.STRING, max_length=100,
            description="City"
        ),
        FieldDefinition(
            name="address_state", display_name="State/Province",
            data_type=DataType.STRING, max_length=100,
            description="State or province"
        ),
        FieldDefinition(
            name="address_country", display_name="Country",
            data_type=DataType.STRING, max_length=100,
            description="Country"
        ),
        FieldDefinition(
            name="address_postal_code", display_name="Postal Code",
            data_type=DataType.STRING, max_length=20,
            description="Postal/ZIP code"
        ),
        FieldDefinition(
            name="is_active", display_name="Is Active",
            data_type=DataType.BOOLEAN, default_value=True,
            description="Whether the contact is active"
        ),
        FieldDefinition(
            name="tags", display_name="Tags",
            data_type=DataType.ARRAY,
            description="Tags for categorization"
        ),
        FieldDefinition(
            name="custom_fields", display_name="Custom Fields",
            data_type=DataType.JSON,
            description="Additional custom fields"
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_contact_email", fields=["email"], type=IndexType.INDEX),
        IndexDefinition(name="idx_contact_account", fields=["account_id"], type=IndexType.INDEX),
        IndexDefinition(name="idx_contact_name", fields=["full_name"], type=IndexType.INDEX),
    ],
    tags=["crm", "contacts"]
)


ACCOUNT_SCHEMA = SchemaDefinition(
    id="canonical_account",
    name="Account",
    display_name="Account/Company",
    version="1.0",
    category=SchemaCategory.CANONICAL,
    description="Standard account/company record",
    is_system=True,
    fields=[
        FieldDefinition(
            name="account_id", display_name="Account ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True
        ),
        FieldDefinition(
            name="name", display_name="Account Name",
            data_type=DataType.STRING, required=True, max_length=255
        ),
        FieldDefinition(
            name="type", display_name="Account Type",
            data_type=DataType.STRING, max_length=50,
            enum_values=["prospect", "customer", "partner", "competitor", "other"]
        ),
        FieldDefinition(
            name="industry", display_name="Industry",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="website", display_name="Website",
            data_type=DataType.URL
        ),
        FieldDefinition(
            name="phone", display_name="Phone",
            data_type=DataType.PHONE
        ),
        FieldDefinition(
            name="email", display_name="Email",
            data_type=DataType.EMAIL
        ),
        FieldDefinition(
            name="employee_count", display_name="Employee Count",
            data_type=DataType.INTEGER, min_value=0
        ),
        FieldDefinition(
            name="annual_revenue", display_name="Annual Revenue",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="address_street", display_name="Street",
            data_type=DataType.STRING
        ),
        FieldDefinition(
            name="address_city", display_name="City",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="address_state", display_name="State",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="address_country", display_name="Country",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="address_postal_code", display_name="Postal Code",
            data_type=DataType.STRING, max_length=20
        ),
        FieldDefinition(
            name="owner_id", display_name="Owner ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="User", references_field="user_id"
        ),
        FieldDefinition(
            name="owner_name", display_name="Owner Name",
            data_type=DataType.STRING, max_length=255
        ),
        FieldDefinition(
            name="is_active", display_name="Is Active",
            data_type=DataType.BOOLEAN, default_value=True
        ),
        FieldDefinition(
            name="tags", display_name="Tags",
            data_type=DataType.ARRAY
        ),
        FieldDefinition(
            name="custom_fields", display_name="Custom Fields",
            data_type=DataType.JSON
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_account_name", fields=["name"], type=IndexType.INDEX),
        IndexDefinition(name="idx_account_industry", fields=["industry"], type=IndexType.INDEX),
        IndexDefinition(name="idx_account_owner", fields=["owner_id"], type=IndexType.INDEX),
    ],
    tags=["crm", "accounts"]
)


ACTIVITY_SCHEMA = SchemaDefinition(
    id="canonical_activity",
    name="Activity",
    display_name="Activity/Task",
    version="1.0",
    category=SchemaCategory.CANONICAL,
    description="Standard activity/task record",
    is_system=True,
    fields=[
        FieldDefinition(
            name="activity_id", display_name="Activity ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True
        ),
        FieldDefinition(
            name="type", display_name="Activity Type",
            data_type=DataType.STRING, required=True, max_length=50,
            enum_values=["call", "email", "meeting", "task", "note", "other"]
        ),
        FieldDefinition(
            name="subject", display_name="Subject",
            data_type=DataType.STRING, required=True, max_length=255
        ),
        FieldDefinition(
            name="description", display_name="Description",
            data_type=DataType.STRING
        ),
        FieldDefinition(
            name="status", display_name="Status",
            data_type=DataType.STRING, max_length=50,
            enum_values=["planned", "in_progress", "completed", "cancelled"]
        ),
        FieldDefinition(
            name="priority", display_name="Priority",
            data_type=DataType.STRING, max_length=20,
            enum_values=["low", "medium", "high", "urgent"]
        ),
        FieldDefinition(
            name="due_date", display_name="Due Date",
            data_type=DataType.DATETIME
        ),
        FieldDefinition(
            name="completed_date", display_name="Completed Date",
            data_type=DataType.DATETIME
        ),
        FieldDefinition(
            name="duration_minutes", display_name="Duration (minutes)",
            data_type=DataType.INTEGER, min_value=0
        ),
        FieldDefinition(
            name="owner_id", display_name="Owner ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="User", references_field="user_id"
        ),
        FieldDefinition(
            name="owner_name", display_name="Owner Name",
            data_type=DataType.STRING, max_length=255
        ),
        FieldDefinition(
            name="opportunity_id", display_name="Opportunity ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="Opportunity", references_field="opportunity_id"
        ),
        FieldDefinition(
            name="contact_id", display_name="Contact ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="Contact", references_field="contact_id"
        ),
        FieldDefinition(
            name="account_id", display_name="Account ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="Account", references_field="account_id"
        ),
        FieldDefinition(
            name="tags", display_name="Tags",
            data_type=DataType.ARRAY
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_activity_type", fields=["type"], type=IndexType.INDEX),
        IndexDefinition(name="idx_activity_status", fields=["status"], type=IndexType.INDEX),
        IndexDefinition(name="idx_activity_due", fields=["due_date"], type=IndexType.INDEX),
        IndexDefinition(name="idx_activity_opp", fields=["opportunity_id"], type=IndexType.INDEX),
    ],
    tags=["crm", "activities"]
)


USER_SCHEMA = SchemaDefinition(
    id="canonical_user",
    name="User",
    display_name="User/Employee",
    version="1.0",
    category=SchemaCategory.CANONICAL,
    description="Standard user/employee record",
    is_system=True,
    fields=[
        FieldDefinition(
            name="user_id", display_name="User ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True
        ),
        FieldDefinition(
            name="username", display_name="Username",
            data_type=DataType.STRING, max_length=100, unique=True
        ),
        FieldDefinition(
            name="email", display_name="Email",
            data_type=DataType.EMAIL, required=True, unique=True
        ),
        FieldDefinition(
            name="first_name", display_name="First Name",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="last_name", display_name="Last Name",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="full_name", display_name="Full Name",
            data_type=DataType.STRING, required=True, max_length=255
        ),
        FieldDefinition(
            name="role", display_name="Role",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="department", display_name="Department",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="team", display_name="Team",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="manager_id", display_name="Manager ID",
            data_type=DataType.STRING, is_foreign_key=True,
            references_schema="User", references_field="user_id"
        ),
        FieldDefinition(
            name="phone", display_name="Phone",
            data_type=DataType.PHONE
        ),
        FieldDefinition(
            name="is_active", display_name="Is Active",
            data_type=DataType.BOOLEAN, default_value=True
        ),
        FieldDefinition(
            name="timezone", display_name="Timezone",
            data_type=DataType.STRING, max_length=50
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_user_email", fields=["email"], type=IndexType.UNIQUE, unique=True),
        IndexDefinition(name="idx_user_team", fields=["team"], type=IndexType.INDEX),
    ],
    tags=["users", "employees"]
)


PRODUCT_SCHEMA = SchemaDefinition(
    id="canonical_product",
    name="Product",
    display_name="Product/Service",
    version="1.0",
    category=SchemaCategory.CANONICAL,
    description="Standard product or service record",
    is_system=True,
    fields=[
        FieldDefinition(
            name="product_id", display_name="Product ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True
        ),
        FieldDefinition(
            name="sku", display_name="SKU",
            data_type=DataType.STRING, max_length=100, unique=True
        ),
        FieldDefinition(
            name="name", display_name="Product Name",
            data_type=DataType.STRING, required=True, max_length=255
        ),
        FieldDefinition(
            name="description", display_name="Description",
            data_type=DataType.STRING
        ),
        FieldDefinition(
            name="category", display_name="Category",
            data_type=DataType.STRING, max_length=100
        ),
        FieldDefinition(
            name="type", display_name="Type",
            data_type=DataType.STRING, max_length=50,
            enum_values=["product", "service", "subscription", "bundle"]
        ),
        FieldDefinition(
            name="unit_price", display_name="Unit Price",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="currency", display_name="Currency",
            data_type=DataType.STRING, max_length=3, default_value="USD"
        ),
        FieldDefinition(
            name="is_active", display_name="Is Active",
            data_type=DataType.BOOLEAN, default_value=True
        ),
        FieldDefinition(
            name="tags", display_name="Tags",
            data_type=DataType.ARRAY
        ),
        FieldDefinition(
            name="custom_fields", display_name="Custom Fields",
            data_type=DataType.JSON
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_product_sku", fields=["sku"], type=IndexType.UNIQUE, unique=True),
        IndexDefinition(name="idx_product_category", fields=["category"], type=IndexType.INDEX),
    ],
    tags=["products", "catalog"]
)


# ==================== INDUSTRY-SPECIFIC SCHEMAS ====================

SAAS_SUBSCRIPTION_SCHEMA = SchemaDefinition(
    id="industry_saas_subscription",
    name="Subscription",
    display_name="SaaS Subscription",
    version="1.0",
    category=SchemaCategory.INDUSTRY,
    industry=IndustryType.SAAS,
    description="SaaS subscription record",
    is_system=True,
    fields=[
        FieldDefinition(
            name="subscription_id", display_name="Subscription ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True
        ),
        FieldDefinition(
            name="account_id", display_name="Account ID",
            data_type=DataType.STRING, required=True, is_foreign_key=True,
            references_schema="Account", references_field="account_id"
        ),
        FieldDefinition(
            name="plan_name", display_name="Plan Name",
            data_type=DataType.STRING, required=True, max_length=100
        ),
        FieldDefinition(
            name="plan_tier", display_name="Plan Tier",
            data_type=DataType.STRING, max_length=50,
            enum_values=["free", "starter", "professional", "enterprise"]
        ),
        FieldDefinition(
            name="status", display_name="Status",
            data_type=DataType.STRING, required=True,
            enum_values=["trial", "active", "past_due", "cancelled", "expired"]
        ),
        FieldDefinition(
            name="mrr", display_name="Monthly Recurring Revenue",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="arr", display_name="Annual Recurring Revenue",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="billing_cycle", display_name="Billing Cycle",
            data_type=DataType.STRING, max_length=20,
            enum_values=["monthly", "quarterly", "annual"]
        ),
        FieldDefinition(
            name="start_date", display_name="Start Date",
            data_type=DataType.DATE, required=True
        ),
        FieldDefinition(
            name="end_date", display_name="End Date",
            data_type=DataType.DATE
        ),
        FieldDefinition(
            name="trial_end_date", display_name="Trial End Date",
            data_type=DataType.DATE
        ),
        FieldDefinition(
            name="cancelled_at", display_name="Cancelled At",
            data_type=DataType.DATETIME
        ),
        FieldDefinition(
            name="cancellation_reason", display_name="Cancellation Reason",
            data_type=DataType.STRING, max_length=255
        ),
        FieldDefinition(
            name="seats", display_name="Number of Seats",
            data_type=DataType.INTEGER, min_value=0
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_sub_account", fields=["account_id"], type=IndexType.INDEX),
        IndexDefinition(name="idx_sub_status", fields=["status"], type=IndexType.INDEX),
    ],
    tags=["saas", "subscriptions", "revenue"]
)


ECOMMERCE_ORDER_SCHEMA = SchemaDefinition(
    id="industry_ecommerce_order",
    name="Order",
    display_name="E-commerce Order",
    version="1.0",
    category=SchemaCategory.INDUSTRY,
    industry=IndustryType.ECOMMERCE,
    description="E-commerce order record",
    is_system=True,
    fields=[
        FieldDefinition(
            name="order_id", display_name="Order ID",
            data_type=DataType.UUID, required=True, primary_key=True, auto_generate=True
        ),
        FieldDefinition(
            name="order_number", display_name="Order Number",
            data_type=DataType.STRING, required=True, max_length=50, unique=True
        ),
        FieldDefinition(
            name="customer_id", display_name="Customer ID",
            data_type=DataType.STRING, required=True, is_foreign_key=True,
            references_schema="Contact", references_field="contact_id"
        ),
        FieldDefinition(
            name="status", display_name="Order Status",
            data_type=DataType.STRING, required=True,
            enum_values=["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]
        ),
        FieldDefinition(
            name="subtotal", display_name="Subtotal",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="tax", display_name="Tax",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="shipping", display_name="Shipping",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="discount", display_name="Discount",
            data_type=DataType.CURRENCY, min_value=0
        ),
        FieldDefinition(
            name="total", display_name="Total",
            data_type=DataType.CURRENCY, required=True, min_value=0
        ),
        FieldDefinition(
            name="currency", display_name="Currency",
            data_type=DataType.STRING, max_length=3, default_value="USD"
        ),
        FieldDefinition(
            name="payment_method", display_name="Payment Method",
            data_type=DataType.STRING, max_length=50
        ),
        FieldDefinition(
            name="payment_status", display_name="Payment Status",
            data_type=DataType.STRING,
            enum_values=["pending", "paid", "failed", "refunded"]
        ),
        FieldDefinition(
            name="shipping_address", display_name="Shipping Address",
            data_type=DataType.JSON
        ),
        FieldDefinition(
            name="billing_address", display_name="Billing Address",
            data_type=DataType.JSON
        ),
        FieldDefinition(
            name="line_items", display_name="Line Items",
            data_type=DataType.JSON
        ),
        FieldDefinition(
            name="notes", display_name="Notes",
            data_type=DataType.STRING
        ),
        FieldDefinition(
            name="ordered_at", display_name="Ordered At",
            data_type=DataType.DATETIME, required=True
        ),
        FieldDefinition(
            name="shipped_at", display_name="Shipped At",
            data_type=DataType.DATETIME
        ),
        FieldDefinition(
            name="delivered_at", display_name="Delivered At",
            data_type=DataType.DATETIME
        ),
        FieldDefinition(
            name="created_at", display_name="Created At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
        FieldDefinition(
            name="updated_at", display_name="Updated At",
            data_type=DataType.DATETIME, auto_generate=True
        ),
    ],
    indexes=[
        IndexDefinition(name="idx_order_number", fields=["order_number"], type=IndexType.UNIQUE, unique=True),
        IndexDefinition(name="idx_order_customer", fields=["customer_id"], type=IndexType.INDEX),
        IndexDefinition(name="idx_order_status", fields=["status"], type=IndexType.INDEX),
        IndexDefinition(name="idx_order_date", fields=["ordered_at"], type=IndexType.INDEX),
    ],
    tags=["ecommerce", "orders", "sales"]
)


# ==================== SCHEMA REGISTRY ====================

BUILTIN_SCHEMAS: Dict[str, SchemaDefinition] = {
    # Canonical
    "canonical_opportunity": OPPORTUNITY_SCHEMA,
    "canonical_contact": CONTACT_SCHEMA,
    "canonical_account": ACCOUNT_SCHEMA,
    "canonical_activity": ACTIVITY_SCHEMA,
    "canonical_user": USER_SCHEMA,
    "canonical_product": PRODUCT_SCHEMA,
    # Industry - SaaS
    "industry_saas_subscription": SAAS_SUBSCRIPTION_SCHEMA,
    # Industry - E-commerce
    "industry_ecommerce_order": ECOMMERCE_ORDER_SCHEMA,
}


def get_builtin_schema(schema_id: str) -> Optional[SchemaDefinition]:
    """Get a built-in schema by ID"""
    return BUILTIN_SCHEMAS.get(schema_id)


def get_schemas_by_category(category: SchemaCategory) -> List[SchemaDefinition]:
    """Get all built-in schemas by category"""
    return [s for s in BUILTIN_SCHEMAS.values() if s.category == category]


def get_schemas_by_industry(industry: IndustryType) -> List[SchemaDefinition]:
    """Get all built-in schemas by industry"""
    return [s for s in BUILTIN_SCHEMAS.values() if s.industry == industry]
