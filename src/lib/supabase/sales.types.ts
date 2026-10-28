// Gerado por `npm run db:sales:types` (supabase gen types, projeto AI Sales). Não editar à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activities": {
                  Row: {
                    "actor_id": string | null,"actor_type": Database["public"]['Enums']["actor_type"],"body": string | null,"contact_id": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["activity_kind"],"lead_id": string | null,"metadata": NonNullable<Json>,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"body"?: string | null,"contact_id"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["activity_kind"],"lead_id"?: string | null,"metadata"?: NonNullable<Json>,"tenant_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"body"?: string | null,"contact_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["activity_kind"],"lead_id"?: string | null,"metadata"?: NonNullable<Json>,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "activities_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_tenant_id_lead_id_fkey"
      columns: ["tenant_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": Database["public"]['Enums']["actor_type"],"created_at": string,"diff": Json | null,"entity_id": string | null,"entity_type": string,"id": string,"reason": string | null,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": Database["public"]['Enums']["actor_type"],"created_at"?: string,"diff"?: Json | null,"entity_id"?: string | null,"entity_type": string,"id"?: string,"reason"?: string | null,"tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"created_at"?: string,"diff"?: Json | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"reason"?: string | null,"tenant_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "city": string | null,"cnae": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document": string | null,"id": string,"name": string,"notes": string | null,"provenance": NonNullable<Json>,"state": string | null,"tenant_id": string,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"cnae"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"provenance"?: NonNullable<Json>,"state"?: string | null,"tenant_id": string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "city"?: string | null,"cnae"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"provenance"?: NonNullable<Json>,"state"?: string | null,"tenant_id"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_records": {
                  Row: {
                    "channel": Database["public"]['Enums']["consent_channel"],"contact_id": string,"evidence": NonNullable<Json>,"expires_at": string | null,"id": string,"legal_basis": Database["public"]['Enums']["legal_basis"],"purpose": Database["public"]['Enums']["consent_purpose"],"recorded_at": string,"recorded_by": string | null,"source": string,"status": Database["public"]['Enums']["consent_status"],"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": Database["public"]['Enums']["consent_channel"],"contact_id": string,"evidence"?: NonNullable<Json>,"expires_at"?: string | null,"id"?: string,"legal_basis": Database["public"]['Enums']["legal_basis"],"purpose": Database["public"]['Enums']["consent_purpose"],"recorded_at"?: string,"recorded_by"?: string | null,"source": string,"status": Database["public"]['Enums']["consent_status"],"tenant_id": string
                  }
                  Update: {
                    "channel"?: Database["public"]['Enums']["consent_channel"],"contact_id"?: string,"evidence"?: NonNullable<Json>,"expires_at"?: string | null,"id"?: string,"legal_basis"?: Database["public"]['Enums']["legal_basis"],"purpose"?: Database["public"]['Enums']["consent_purpose"],"recorded_at"?: string,"recorded_by"?: string | null,"source"?: string,"status"?: Database["public"]['Enums']["consent_status"],"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_records_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "consent_records_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_tags": {
                  Row: {
                    "contact_id": string,"created_at": string,"tag_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id": string,"created_at"?: string,"tag_id": string,"tenant_id": string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"tag_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_tags_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "contact_tags_tenant_id_tag_id_fkey"
      columns: ["tenant_id","tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "city": string | null,"company_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string | null,"email_normalized": string | null,"full_name": string,"id": string,"job_title": string | null,"notes": string | null,"phone_e164": string | null,"provenance": NonNullable<Json>,"state": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"email_normalized"?: never,"full_name": string,"id"?: string,"job_title"?: string | null,"notes"?: string | null,"phone_e164"?: string | null,"provenance"?: NonNullable<Json>,"state"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "city"?: string | null,"company_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"email_normalized"?: never,"full_name"?: string,"id"?: string,"job_title"?: string | null,"notes"?: string | null,"phone_e164"?: string | null,"provenance"?: NonNullable<Json>,"state"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_tenant_id_company_id_fkey"
      columns: ["tenant_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "contacts_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"imports": {
                  Row: {
                    "consent_declared": boolean,"created_at": string,"created_by": string | null,"created_contacts": number,"created_leads": number,"declared_origin": string,"errors": NonNullable<Json>,"file_name": string,"id": string,"lead_source_id": string | null,"rejected_rows": number,"tenant_id": string,"total_rows": number,"updated_contacts": number
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_declared"?: boolean,"created_at"?: string,"created_by"?: string | null,"created_contacts"?: number,"created_leads"?: number,"declared_origin": string,"errors"?: NonNullable<Json>,"file_name": string,"id"?: string,"lead_source_id"?: string | null,"rejected_rows"?: number,"tenant_id": string,"total_rows"?: number,"updated_contacts"?: number
                  }
                  Update: {
                    "consent_declared"?: boolean,"created_at"?: string,"created_by"?: string | null,"created_contacts"?: number,"created_leads"?: number,"declared_origin"?: string,"errors"?: NonNullable<Json>,"file_name"?: string,"id"?: string,"lead_source_id"?: string | null,"rejected_rows"?: number,"tenant_id"?: string,"total_rows"?: number,"updated_contacts"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "imports_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "imports_tenant_id_lead_source_id_fkey"
      columns: ["tenant_id","lead_source_id"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"lead_sources": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"kind": Database["public"]['Enums']["lead_source_kind"],"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["lead_source_kind"],"name": string,"tenant_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["lead_source_kind"],"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_sources_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "company_id": string | null,"contact_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"discovery_stage": Database["public"]['Enums']["discovery_stage"],"id": string,"lead_source_id": string | null,"owner_user_id": string | null,"pipeline_id": string,"qualification": Database["public"]['Enums']["lead_qualification"],"score": number | null,"stage_changed_at": string,"stage_id": string,"tenant_id": string,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id"?: string | null,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"discovery_stage"?: Database["public"]['Enums']["discovery_stage"],"id"?: string,"lead_source_id"?: string | null,"owner_user_id"?: string | null,"pipeline_id": string,"qualification"?: Database["public"]['Enums']["lead_qualification"],"score"?: number | null,"stage_changed_at"?: string,"stage_id": string,"tenant_id": string,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string | null,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"discovery_stage"?: Database["public"]['Enums']["discovery_stage"],"id"?: string,"lead_source_id"?: string | null,"owner_user_id"?: string | null,"pipeline_id"?: string,"qualification"?: Database["public"]['Enums']["lead_qualification"],"score"?: number | null,"stage_changed_at"?: string,"stage_id"?: string,"tenant_id"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_tenant_id_company_id_fkey"
      columns: ["tenant_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "leads_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "leads_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_tenant_id_lead_source_id_fkey"
      columns: ["tenant_id","lead_source_id"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "leads_tenant_id_owner_user_id_fkey"
      columns: ["tenant_id","owner_user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["tenant_id","user_id"]
    },{
      foreignKeyName: "leads_tenant_id_pipeline_id_stage_id_fkey"
      columns: ["tenant_id","pipeline_id","stage_id"]
isOneToOne: false
      referencedRelation: "pipeline_stages"
      referencedColumns: ["tenant_id","pipeline_id","id"]
    }
                  ]
                },"opportunities": {
                  Row: {
                    "amount_cents": number | null,"closed_at": string | null,"created_at": string,"created_by": string | null,"currency": string,"expected_close_date": string | null,"id": string,"lead_id": string,"lost_reason": string | null,"owner_user_id": string | null,"status": Database["public"]['Enums']["opportunity_status"],"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents"?: number | null,"closed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"expected_close_date"?: string | null,"id"?: string,"lead_id": string,"lost_reason"?: string | null,"owner_user_id"?: string | null,"status"?: Database["public"]['Enums']["opportunity_status"],"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number | null,"closed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"expected_close_date"?: string | null,"id"?: string,"lead_id"?: string,"lost_reason"?: string | null,"owner_user_id"?: string | null,"status"?: Database["public"]['Enums']["opportunity_status"],"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_tenant_id_lead_id_fkey"
      columns: ["tenant_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "opportunities_tenant_id_owner_user_id_fkey"
      columns: ["tenant_id","owner_user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["tenant_id","user_id"]
    }
                  ]
                },"organization_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email_normalized": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["org_role"],"tenant_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email_normalized": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role": Database["public"]['Enums']["org_role"],"tenant_id": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email_normalized"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["org_role"],"tenant_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_invites_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "created_at": string,"invited_by": string | null,"role": Database["public"]['Enums']["org_role"],"status": Database["public"]['Enums']["member_status"],"tenant_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"invited_by"?: string | null,"role": Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["member_status"],"tenant_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["member_status"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_settings": {
                  Row: {
                    "locale": string,"require_mfa": boolean,"sales_visibility": Database["public"]['Enums']["sales_visibility"],"tenant_id": string,"timezone": string,"updated_at": string,"updated_by": string | null,"viewer_can_read_conversations": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "locale"?: string,"require_mfa"?: boolean,"sales_visibility"?: Database["public"]['Enums']["sales_visibility"],"tenant_id": string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"viewer_can_read_conversations"?: boolean
                  }
                  Update: {
                    "locale"?: string,"require_mfa"?: boolean,"sales_visibility"?: Database["public"]['Enums']["sales_visibility"],"tenant_id"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"viewer_can_read_conversations"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_settings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document": string | null,"id": string,"legal_name": string | null,"name": string,"slug": string,"status": Database["public"]['Enums']["org_status"],"status_reason": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document"?: string | null,"id"?: string,"legal_name"?: string | null,"name": string,"slug": string,"status"?: Database["public"]['Enums']["org_status"],"status_reason"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document"?: string | null,"id"?: string,"legal_name"?: string | null,"name"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["org_status"],"status_reason"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pipeline_stages": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"is_lost": boolean,"is_qualified": boolean,"is_won": boolean,"name": string,"pipeline_id": string,"position": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"is_lost"?: boolean,"is_qualified"?: boolean,"is_won"?: boolean,"name": string,"pipeline_id": string,"position": number,"tenant_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"is_lost"?: boolean,"is_qualified"?: boolean,"is_won"?: boolean,"name"?: string,"pipeline_id"?: string,"position"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipeline_stages_tenant_id_pipeline_id_fkey"
      columns: ["tenant_id","pipeline_id"]
isOneToOne: false
      referencedRelation: "pipelines"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"pipelines": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipelines_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "bucket_key": string,"count": number,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_key": string,"count"?: number,"window_start": string
                  }
                  Update: {
                    "bucket_key"?: string,"count"?: number,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscription_plans": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"description": string | null,"entitlements": NonNullable<Json>,"is_public": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"description"?: string | null,"entitlements"?: NonNullable<Json>,"is_public"?: boolean,"name": string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"description"?: string | null,"entitlements"?: NonNullable<Json>,"is_public"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "billing_mode": Database["public"]['Enums']["billing_mode"],"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"external_ref": string | null,"id": string,"limit_overrides": NonNullable<Json>,"notes": string | null,"plan_code": string,"status": Database["public"]['Enums']["subscription_status"],"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_mode"?: Database["public"]['Enums']["billing_mode"],"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"external_ref"?: string | null,"id"?: string,"limit_overrides"?: NonNullable<Json>,"notes"?: string | null,"plan_code": string,"status"?: Database["public"]['Enums']["subscription_status"],"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "billing_mode"?: Database["public"]['Enums']["billing_mode"],"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"external_ref"?: string | null,"id"?: string,"limit_overrides"?: NonNullable<Json>,"notes"?: string | null,"plan_code"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "subscription_plans"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "subscriptions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"suppression_list": {
                  Row: {
                    "channel": Database["public"]['Enums']["consent_channel"],"created_at": string,"created_by": string | null,"id": string,"identifier": string,"reason": Database["public"]['Enums']["suppression_reason"],"source": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": Database["public"]['Enums']["consent_channel"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"identifier": string,"reason": Database["public"]['Enums']["suppression_reason"],"source": string,"tenant_id": string
                  }
                  Update: {
                    "channel"?: Database["public"]['Enums']["consent_channel"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"identifier"?: string,"reason"?: Database["public"]['Enums']["suppression_reason"],"source"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppression_list_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name": string,"tenant_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tags_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_user_id": string | null,"completed_at": string | null,"contact_id": string | null,"created_at": string,"created_by": string | null,"due_at": string | null,"id": string,"lead_id": string | null,"status": Database["public"]['Enums']["task_status"],"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_user_id"?: string | null,"completed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"id"?: string,"lead_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_user_id"?: string | null,"completed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"id"?: string,"lead_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_tenant_id_assignee_user_id_fkey"
      columns: ["tenant_id","assignee_user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["tenant_id","user_id"]
    },{
      foreignKeyName: "tasks_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "tasks_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_tenant_id_lead_id_fkey"
      columns: ["tenant_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"usage_records": {
                  Row: {
                    "created_at": string,"id": string,"idempotency_key": string,"metric": string,"period_month": string,"quantity": number,"source_id": string | null,"source_type": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"idempotency_key": string,"metric": string,"period_month": string,"quantity": number,"source_id"?: string | null,"source_type"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"idempotency_key"?: string,"metric"?: string,"period_month"?: string,"quantity"?: number,"source_id"?: string | null,"source_type"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_records_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_reservations": {
                  Row: {
                    "actual_amount": number | null,"amount": number,"created_at": string,"expires_at": string,"finished_at": string | null,"id": string,"idempotency_key": string,"metric": string,"period_month": string,"status": Database["public"]['Enums']["reservation_status"],"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_amount"?: number | null,"amount": number,"created_at"?: string,"expires_at": string,"finished_at"?: string | null,"id"?: string,"idempotency_key": string,"metric": string,"period_month": string,"status"?: Database["public"]['Enums']["reservation_status"],"tenant_id": string
                  }
                  Update: {
                    "actual_amount"?: number | null,"amount"?: number,"created_at"?: string,"expires_at"?: string,"finished_at"?: string | null,"id"?: string,"idempotency_key"?: string,"metric"?: string,"period_month"?: string,"status"?: Database["public"]['Enums']["reservation_status"],"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_reservations_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"user_profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "current_consents": {
                  Row: {
                    "channel": Database["public"]['Enums']["consent_channel"],"contact_id": string,"expires_at": string | null,"id": string,"is_valid": boolean | null,"legal_basis": Database["public"]['Enums']["legal_basis"],"purpose": Database["public"]['Enums']["consent_purpose"],"recorded_at": string,"recorded_by": string | null,"source": string,"status": Database["public"]['Enums']["consent_status"],"tenant_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "consent_records_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "consent_records_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token_hash": string }; Returns: string
                           },
"consume_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"create_invite":
{ Args: { "p_email": string,"p_role": Database["public"]['Enums']["org_role"],"p_tenant": string,"p_token_hash": string }; Returns: string
                           },
"crm_dashboard":
{ Args: { "p_from": string,"p_tenant": string,"p_to": string }; Returns: Json
                           },
"effective_limit":
{ Args: { "p_metric": string,"p_tenant": string }; Returns: number
                           },
"get_invite_preview":
{ Args: { "p_token_hash": string }; Returns: {
              "email": string,"expires_at": string,"organization_name": string,"organization_slug": string,"role": Database["public"]['Enums']["org_role"]
            }[]
                           },
"import_contacts":
{ Args: { "p_consent_declared": boolean,"p_create_leads": boolean,"p_declared_origin": string,"p_file_name": string,"p_rejected"?: Json,"p_rows": Json,"p_source": string,"p_tenant": string }; Returns: {
              "consent_declared": boolean,
"created_at": string,
"created_by": string | null,
"created_contacts": number,
"created_leads": number,
"declared_origin": string,
"errors": NonNullable<Json>,
"file_name": string,
"id": string,
"lead_source_id": string | null,
"rejected_rows": number,
"tenant_id": string,
"total_rows": number,
"updated_contacts": number
            }
                          SetofOptions: {
        from: "*"
        to: "imports"
        isOneToOne: true
        isSetofReturn: false
      } },
"platform_create_organization":
{ Args: { "p_actor": string,"p_document"?: string,"p_legal_name"?: string,"p_name": string,"p_owner_email": string,"p_owner_token_hash": string,"p_plan_code"?: string,"p_reason"?: string,"p_slug": string }; Returns: string
                           },
"platform_invite_owner":
{ Args: { "p_actor": string,"p_email": string,"p_reason"?: string,"p_tenant": string,"p_token_hash": string }; Returns: string
                           },
"platform_set_organization_status":
{ Args: { "p_actor": string,"p_reason": string,"p_status": Database["public"]['Enums']["org_status"],"p_tenant": string }; Returns: undefined
                           },
"record_export":
{ Args: { "p_entity": string,"p_filters": Json,"p_rows": number,"p_tenant": string }; Returns: undefined
                           },
"release_usage":
{ Args: { "p_reservation": string,"p_tenant": string }; Returns: undefined
                           },
"reserve_usage":
{ Args: { "p_amount": number,"p_key": string,"p_metric": string,"p_tenant": string,"p_ttl_seconds"?: number }; Returns: string
                           },
"settle_usage":
{ Args: { "p_actual": number,"p_reservation": string,"p_source_id"?: string,"p_source_type"?: string,"p_tenant": string }; Returns: undefined
                           }
          }
          Enums: {
            "activity_kind": "note"|"call"|"email"|"meeting"|"message"|"stage_change"|"consent_change"|"task"|"import"|"system","actor_type": "user"|"agent"|"system"|"platform_admin","billing_mode": "manual"|"gateway","consent_channel": "whatsapp"|"email"|"phone","consent_purpose": "marketing"|"sales_followup"|"service"|"transactional","consent_status": "granted"|"revoked","discovery_stage": "company_identified"|"contact_found"|"contact_authorized"|"qualified_opportunity","lead_qualification": "unknown"|"cold"|"warm"|"hot","lead_source_kind": "manual"|"form"|"csv"|"ads"|"api"|"research"|"whatsapp_inbound"|"referral","legal_basis": "consent"|"legitimate_interest"|"contract"|"legal_obligation","member_status": "active"|"disabled","opportunity_status": "open"|"won"|"lost","org_role": "viewer"|"sales"|"manager"|"admin"|"owner","org_status": "active"|"suspended"|"closed","reservation_status": "reserved"|"settled"|"released","sales_visibility": "all"|"assigned","subscription_status": "trial"|"active"|"past_due"|"canceled"|"internal","suppression_reason": "opt_out"|"complaint"|"blocked"|"invalid"|"legal_request","task_status": "open"|"done"|"canceled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "activity_kind": ["note", "call", "email", "meeting", "message", "stage_change", "consent_change", "task", "import", "system"],"actor_type": ["user", "agent", "system", "platform_admin"],"billing_mode": ["manual", "gateway"],"consent_channel": ["whatsapp", "email", "phone"],"consent_purpose": ["marketing", "sales_followup", "service", "transactional"],"consent_status": ["granted", "revoked"],"discovery_stage": ["company_identified", "contact_found", "contact_authorized", "qualified_opportunity"],"lead_qualification": ["unknown", "cold", "warm", "hot"],"lead_source_kind": ["manual", "form", "csv", "ads", "api", "research", "whatsapp_inbound", "referral"],"legal_basis": ["consent", "legitimate_interest", "contract", "legal_obligation"],"member_status": ["active", "disabled"],"opportunity_status": ["open", "won", "lost"],"org_role": ["viewer", "sales", "manager", "admin", "owner"],"org_status": ["active", "suspended", "closed"],"reservation_status": ["reserved", "settled", "released"],"sales_visibility": ["all", "assigned"],"subscription_status": ["trial", "active", "past_due", "canceled", "internal"],"suppression_reason": ["opt_out", "complaint", "blocked", "invalid", "legal_request"],"task_status": ["open", "done", "canceled"]
          }
        }
} as const
