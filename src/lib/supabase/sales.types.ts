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
                },"agent_executions": {
                  Row: {
                    "agent_id": string,"cost_usd": number | null,"error": string | null,"estimated_cost_usd": number | null,"finished_at": string | null,"id": string,"idempotency_key": string,"input_summary": NonNullable<Json>,"is_test": boolean,"latency_ms": number | null,"output": Json | null,"reservation_id": string | null,"started_at": string,"status": Database["public"]['Enums']["execution_status"],"tenant_id": string,"token_usage": Json | null,"trigger_ref": string | null,"trigger_type": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id": string,"cost_usd"?: number | null,"error"?: string | null,"estimated_cost_usd"?: number | null,"finished_at"?: string | null,"id"?: string,"idempotency_key": string,"input_summary"?: NonNullable<Json>,"is_test"?: boolean,"latency_ms"?: number | null,"output"?: Json | null,"reservation_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["execution_status"],"tenant_id": string,"token_usage"?: Json | null,"trigger_ref"?: string | null,"trigger_type": string,"version_id": string
                  }
                  Update: {
                    "agent_id"?: string,"cost_usd"?: number | null,"error"?: string | null,"estimated_cost_usd"?: number | null,"finished_at"?: string | null,"id"?: string,"idempotency_key"?: string,"input_summary"?: NonNullable<Json>,"is_test"?: boolean,"latency_ms"?: number | null,"output"?: Json | null,"reservation_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["execution_status"],"tenant_id"?: string,"token_usage"?: Json | null,"trigger_ref"?: string | null,"trigger_type"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_executions_tenant_id_agent_id_fkey"
      columns: ["tenant_id","agent_id"]
isOneToOne: false
      referencedRelation: "ai_agents"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "agent_executions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_executions_tenant_id_version_id_fkey"
      columns: ["tenant_id","version_id"]
isOneToOne: false
      referencedRelation: "agent_versions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"agent_handoffs": {
                  Row: {
                    "conversation_id": string,"created_at": string,"execution_id": string | null,"id": string,"reason": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"execution_id"?: string | null,"id"?: string,"reason": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"execution_id"?: string | null,"id"?: string,"reason"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_handoffs_tenant_id_conversation_id_fkey"
      columns: ["tenant_id","conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "agent_handoffs_tenant_id_execution_id_fkey"
      columns: ["tenant_id","execution_id"]
isOneToOne: false
      referencedRelation: "agent_executions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"agent_tool_calls": {
                  Row: {
                    "arguments": NonNullable<Json>,"created_at": string,"decision": Database["public"]['Enums']["tool_decision"],"execution_id": string,"id": string,"result": string | null,"tenant_id": string,"tool": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arguments"?: NonNullable<Json>,"created_at"?: string,"decision": Database["public"]['Enums']["tool_decision"],"execution_id": string,"id"?: string,"result"?: string | null,"tenant_id": string,"tool": string
                  }
                  Update: {
                    "arguments"?: NonNullable<Json>,"created_at"?: string,"decision"?: Database["public"]['Enums']["tool_decision"],"execution_id"?: string,"id"?: string,"result"?: string | null,"tenant_id"?: string,"tool"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_tool_calls_tenant_id_execution_id_fkey"
      columns: ["tenant_id","execution_id"]
isOneToOne: false
      referencedRelation: "agent_executions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"agent_versions": {
                  Row: {
                    "agent_id": string,"created_at": string,"created_by": string | null,"id": string,"input_price_per_mtok": number,"knowledge_base_ids": (string)[],"max_output_tokens": number,"model": string,"notes": string | null,"output_price_per_mtok": number,"provider": string,"system_prompt": string,"tenant_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"input_price_per_mtok"?: number,"knowledge_base_ids"?: (string)[],"max_output_tokens"?: number,"model": string,"notes"?: string | null,"output_price_per_mtok"?: number,"provider": string,"system_prompt": string,"tenant_id": string,"version": number
                  }
                  Update: {
                    "agent_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"input_price_per_mtok"?: number,"knowledge_base_ids"?: (string)[],"max_output_tokens"?: number,"model"?: string,"notes"?: string | null,"output_price_per_mtok"?: number,"provider"?: string,"system_prompt"?: string,"tenant_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_versions_tenant_id_agent_id_fkey"
      columns: ["tenant_id","agent_id"]
isOneToOne: false
      referencedRelation: "ai_agents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"ai_agents": {
                  Row: {
                    "auto_take_new_conversations": boolean,"created_at": string,"created_by": string | null,"current_version_id": string | null,"daily_executions_limit": number,"handoff_confidence": number,"id": string,"max_replies_per_conversation": number,"name": string,"objective": string | null,"phone_number_id": string | null,"status": Database["public"]['Enums']["agent_status"],"tenant_id": string,"type": Database["public"]['Enums']["agent_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_take_new_conversations"?: boolean,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"daily_executions_limit"?: number,"handoff_confidence"?: number,"id"?: string,"max_replies_per_conversation"?: number,"name": string,"objective"?: string | null,"phone_number_id"?: string | null,"status"?: Database["public"]['Enums']["agent_status"],"tenant_id": string,"type": Database["public"]['Enums']["agent_type"],"updated_at"?: string
                  }
                  Update: {
                    "auto_take_new_conversations"?: boolean,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"daily_executions_limit"?: number,"handoff_confidence"?: number,"id"?: string,"max_replies_per_conversation"?: number,"name"?: string,"objective"?: string | null,"phone_number_id"?: string | null,"status"?: Database["public"]['Enums']["agent_status"],"tenant_id"?: string,"type"?: Database["public"]['Enums']["agent_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_agents_current_version_fkey"
      columns: ["tenant_id","current_version_id"]
isOneToOne: false
      referencedRelation: "agent_versions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "ai_agents_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_agents_tenant_id_phone_number_id_fkey"
      columns: ["tenant_id","phone_number_id"]
isOneToOne: false
      referencedRelation: "whatsapp_phone_numbers"
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
                },"billing_invoices": {
                  Row: {
                    "amount_cents": number,"canceled_at": string | null,"created_at": string,"created_by": string | null,"currency": string,"description": string,"due_date": string,"external_ref": string | null,"id": string,"issued_at": string | null,"notes": string | null,"number": string,"paid_at": string | null,"payment_method": string | null,"period_end": string | null,"period_start": string | null,"status": Database["public"]['Enums']["invoice_status"],"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"canceled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description": string,"due_date": string,"external_ref"?: string | null,"id"?: string,"issued_at"?: string | null,"notes"?: string | null,"number"?: string,"paid_at"?: string | null,"payment_method"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"canceled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string,"due_date"?: string,"external_ref"?: string | null,"id"?: string,"issued_at"?: string | null,"notes"?: string | null,"number"?: string,"paid_at"?: string | null,"payment_method"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_invoices_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_recipients": {
                  Row: {
                    "campaign_id": string,"contact_id": string,"detail": string | null,"eligibility": string,"exclusion_reason": string | null,"id": string,"processed_at": string | null,"send_request_id": string | null,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"contact_id": string,"detail"?: string | null,"eligibility": string,"exclusion_reason"?: string | null,"id"?: string,"processed_at"?: string | null,"send_request_id"?: string | null,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "campaign_id"?: string,"contact_id"?: string,"detail"?: string | null,"eligibility"?: string,"exclusion_reason"?: string | null,"id"?: string,"processed_at"?: string | null,"send_request_id"?: string | null,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_recipients_tenant_id_campaign_id_fkey"
      columns: ["tenant_id","campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "campaign_recipients_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "campaign_recipients_tenant_id_send_request_id_fkey"
      columns: ["tenant_id","send_request_id"]
isOneToOne: false
      referencedRelation: "message_send_requests"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"campaign_runs": {
                  Row: {
                    "blocked": number,"campaign_id": string,"failed": number,"finished_at": string | null,"id": string,"planned": number,"sent": number,"started_at": string,"stopped_reason": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked"?: number,"campaign_id": string,"failed"?: number,"finished_at"?: string | null,"id"?: string,"planned"?: number,"sent"?: number,"started_at"?: string,"stopped_reason"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "blocked"?: number,"campaign_id"?: string,"failed"?: number,"finished_at"?: string | null,"id"?: string,"planned"?: number,"sent"?: number,"started_at"?: string,"stopped_reason"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_runs_tenant_id_campaign_id_fkey"
      columns: ["tenant_id","campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"audience_built_at": string | null,"audience_filter": NonNullable<Json>,"created_at": string,"created_by": string | null,"daily_limit": number,"eligible_count": number,"emergency_stopped_at": string | null,"excluded_count": number,"hourly_limit": number,"id": string,"name": string,"objective": string | null,"phone_number_id": string,"purpose": Database["public"]['Enums']["consent_purpose"],"starts_at": string | null,"status": Database["public"]['Enums']["campaign_status"],"status_reason": string | null,"template_id": string,"template_parameters": NonNullable<Json>,"tenant_id": string,"total_limit": number,"updated_at": string,"window_end": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"audience_built_at"?: string | null,"audience_filter"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"daily_limit"?: number,"eligible_count"?: number,"emergency_stopped_at"?: string | null,"excluded_count"?: number,"hourly_limit"?: number,"id"?: string,"name": string,"objective"?: string | null,"phone_number_id": string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"starts_at"?: string | null,"status"?: Database["public"]['Enums']["campaign_status"],"status_reason"?: string | null,"template_id": string,"template_parameters"?: NonNullable<Json>,"tenant_id": string,"total_limit"?: number,"updated_at"?: string,"window_end"?: string,"window_start"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"audience_built_at"?: string | null,"audience_filter"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"daily_limit"?: number,"eligible_count"?: number,"emergency_stopped_at"?: string | null,"excluded_count"?: number,"hourly_limit"?: number,"id"?: string,"name"?: string,"objective"?: string | null,"phone_number_id"?: string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"starts_at"?: string | null,"status"?: Database["public"]['Enums']["campaign_status"],"status_reason"?: string | null,"template_id"?: string,"template_parameters"?: NonNullable<Json>,"tenant_id"?: string,"total_limit"?: number,"updated_at"?: string,"window_end"?: string,"window_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_tenant_id_phone_number_id_fkey"
      columns: ["tenant_id","phone_number_id"]
isOneToOne: false
      referencedRelation: "whatsapp_phone_numbers"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "campaigns_tenant_id_template_id_fkey"
      columns: ["tenant_id","template_id"]
isOneToOne: false
      referencedRelation: "whatsapp_templates"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"capture_form_consent_versions": {
                  Row: {
                    "consent_channels": (Database["public"]['Enums']["consent_channel"])[],"consent_purposes": (Database["public"]['Enums']["consent_purpose"])[],"consent_text": string,"created_at": string,"form_id": string,"tenant_id": string,"text_hash": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_channels": (Database["public"]['Enums']["consent_channel"])[],"consent_purposes": (Database["public"]['Enums']["consent_purpose"])[],"consent_text": string,"created_at"?: string,"form_id": string,"tenant_id": string,"text_hash": string,"version": number
                  }
                  Update: {
                    "consent_channels"?: (Database["public"]['Enums']["consent_channel"])[],"consent_purposes"?: (Database["public"]['Enums']["consent_purpose"])[],"consent_text"?: string,"created_at"?: string,"form_id"?: string,"tenant_id"?: string,"text_hash"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "capture_form_consent_versions_tenant_id_form_id_fkey"
      columns: ["tenant_id","form_id"]
isOneToOne: false
      referencedRelation: "capture_forms"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"capture_forms": {
                  Row: {
                    "consent_channels": (Database["public"]['Enums']["consent_channel"])[],"consent_purposes": (Database["public"]['Enums']["consent_purpose"])[],"consent_text": string,"consent_version": number,"created_at": string,"created_by": string | null,"description": string | null,"fields": (string)[],"headline": string,"id": string,"lead_source_id": string | null,"name": string,"public_key": string,"status": Database["public"]['Enums']["capture_form_status"],"submissions_count": number,"success_message": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_channels"?: (Database["public"]['Enums']["consent_channel"])[],"consent_purposes"?: (Database["public"]['Enums']["consent_purpose"])[],"consent_text": string,"consent_version"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"fields"?: (string)[],"headline": string,"id"?: string,"lead_source_id"?: string | null,"name": string,"public_key"?: string,"status"?: Database["public"]['Enums']["capture_form_status"],"submissions_count"?: number,"success_message"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "consent_channels"?: (Database["public"]['Enums']["consent_channel"])[],"consent_purposes"?: (Database["public"]['Enums']["consent_purpose"])[],"consent_text"?: string,"consent_version"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"fields"?: (string)[],"headline"?: string,"id"?: string,"lead_source_id"?: string | null,"name"?: string,"public_key"?: string,"status"?: Database["public"]['Enums']["capture_form_status"],"submissions_count"?: number,"success_message"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "capture_forms_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "capture_forms_tenant_id_lead_source_id_fkey"
      columns: ["tenant_id","lead_source_id"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "city": string | null,"cnae": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document": string | null,"enriched_at": string | null,"id": string,"name": string,"notes": string | null,"opened_on": string | null,"provenance": NonNullable<Json>,"registration_status": string | null,"size": string | null,"state": string | null,"tenant_id": string,"trade_name": string | null,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"cnae"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"enriched_at"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"opened_on"?: string | null,"provenance"?: NonNullable<Json>,"registration_status"?: string | null,"size"?: string | null,"state"?: string | null,"tenant_id": string,"trade_name"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "city"?: string | null,"cnae"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document"?: string | null,"enriched_at"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"opened_on"?: string | null,"provenance"?: NonNullable<Json>,"registration_status"?: string | null,"size"?: string | null,"state"?: string | null,"tenant_id"?: string,"trade_name"?: string | null,"updated_at"?: string,"website"?: string | null
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
                },"company_enrichments": {
                  Row: {
                    "applied_fields": (string)[],"company_id": string | null,"data": NonNullable<Json>,"document": string,"fetched_at": string,"fetched_by": string | null,"id": string,"source": string,"status": Database["public"]['Enums']["enrichment_status"],"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_fields"?: (string)[],"company_id"?: string | null,"data"?: NonNullable<Json>,"document": string,"fetched_at"?: string,"fetched_by"?: string | null,"id"?: string,"source": string,"status": Database["public"]['Enums']["enrichment_status"],"tenant_id": string
                  }
                  Update: {
                    "applied_fields"?: (string)[],"company_id"?: string | null,"data"?: NonNullable<Json>,"document"?: string,"fetched_at"?: string,"fetched_by"?: string | null,"id"?: string,"source"?: string,"status"?: Database["public"]['Enums']["enrichment_status"],"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_enrichments_tenant_id_company_id_fkey"
      columns: ["tenant_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "company_enrichments_tenant_id_fkey"
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
                },"conversations": {
                  Row: {
                    "assigned_user_id": string | null,"contact_id": string,"created_at": string,"handled_by": string,"id": string,"last_inbound_at": string | null,"last_message_at": string,"last_message_preview": string | null,"phone_number_id": string,"status": Database["public"]['Enums']["conversation_status"],"tenant_id": string,"unread_count": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_user_id"?: string | null,"contact_id": string,"created_at"?: string,"handled_by"?: string,"id"?: string,"last_inbound_at"?: string | null,"last_message_at"?: string,"last_message_preview"?: string | null,"phone_number_id": string,"status"?: Database["public"]['Enums']["conversation_status"],"tenant_id": string,"unread_count"?: number,"updated_at"?: string
                  }
                  Update: {
                    "assigned_user_id"?: string | null,"contact_id"?: string,"created_at"?: string,"handled_by"?: string,"id"?: string,"last_inbound_at"?: string | null,"last_message_at"?: string,"last_message_preview"?: string | null,"phone_number_id"?: string,"status"?: Database["public"]['Enums']["conversation_status"],"tenant_id"?: string,"unread_count"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_tenant_id_assigned_user_id_fkey"
      columns: ["tenant_id","assigned_user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["tenant_id","user_id"]
    },{
      foreignKeyName: "conversations_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "conversations_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_tenant_id_phone_number_id_fkey"
      columns: ["tenant_id","phone_number_id"]
isOneToOne: false
      referencedRelation: "whatsapp_phone_numbers"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"followup_executions": {
                  Row: {
                    "attempt": number,"created_at": string,"detail": string | null,"id": string,"lead_id": string,"rule_id": string,"send_request_id": string | null,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt": number,"created_at"?: string,"detail"?: string | null,"id"?: string,"lead_id": string,"rule_id": string,"send_request_id"?: string | null,"status": string,"tenant_id": string
                  }
                  Update: {
                    "attempt"?: number,"created_at"?: string,"detail"?: string | null,"id"?: string,"lead_id"?: string,"rule_id"?: string,"send_request_id"?: string | null,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "followup_executions_tenant_id_lead_id_fkey"
      columns: ["tenant_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "followup_executions_tenant_id_rule_id_fkey"
      columns: ["tenant_id","rule_id"]
isOneToOne: false
      referencedRelation: "followup_rules"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"followup_rules": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"id": string,"idle_days": number,"max_attempts": number,"max_per_run": number,"min_interval_days": number,"name": string,"phone_number_id": string,"purpose": Database["public"]['Enums']["consent_purpose"],"stage_ids": (string)[],"template_id": string,"template_parameters": NonNullable<Json>,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idle_days"?: number,"max_attempts"?: number,"max_per_run"?: number,"min_interval_days"?: number,"name": string,"phone_number_id": string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"stage_ids"?: (string)[],"template_id": string,"template_parameters"?: NonNullable<Json>,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"idle_days"?: number,"max_attempts"?: number,"max_per_run"?: number,"min_interval_days"?: number,"name"?: string,"phone_number_id"?: string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"stage_ids"?: (string)[],"template_id"?: string,"template_parameters"?: NonNullable<Json>,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "followup_rules_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "followup_rules_tenant_id_phone_number_id_fkey"
      columns: ["tenant_id","phone_number_id"]
isOneToOne: false
      referencedRelation: "whatsapp_phone_numbers"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "followup_rules_tenant_id_template_id_fkey"
      columns: ["tenant_id","template_id"]
isOneToOne: false
      referencedRelation: "whatsapp_templates"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"form_submissions": {
                  Row: {
                    "consent_given": boolean,"consent_version": number,"contact_id": string | null,"created_at": string,"fields_received": (string)[],"form_id": string,"id": string,"ip_hash": string | null,"lead_id": string | null,"payload_hash": string,"tenant_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_given": boolean,"consent_version": number,"contact_id"?: string | null,"created_at"?: string,"fields_received"?: (string)[],"form_id": string,"id"?: string,"ip_hash"?: string | null,"lead_id"?: string | null,"payload_hash": string,"tenant_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "consent_given"?: boolean,"consent_version"?: number,"contact_id"?: string | null,"created_at"?: string,"fields_received"?: (string)[],"form_id"?: string,"id"?: string,"ip_hash"?: string | null,"lead_id"?: string | null,"payload_hash"?: string,"tenant_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_submissions_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "form_submissions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_submissions_tenant_id_form_id_fkey"
      columns: ["tenant_id","form_id"]
isOneToOne: false
      referencedRelation: "capture_forms"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "form_submissions_tenant_id_lead_id_fkey"
      columns: ["tenant_id","lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["tenant_id","id"]
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
                },"knowledge_bases": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_bases_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"knowledge_chunks": {
                  Row: {
                    "chunk_index": number,"content": string,"document_id": string,"fts": unknown,"id": string,"knowledge_base_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chunk_index": number,"content": string,"document_id": string,"fts"?: never,"id"?: string,"knowledge_base_id": string,"tenant_id": string
                  }
                  Update: {
                    "chunk_index"?: number,"content"?: string,"document_id"?: string,"fts"?: never,"id"?: string,"knowledge_base_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_chunks_tenant_id_document_id_fkey"
      columns: ["tenant_id","document_id"]
isOneToOne: false
      referencedRelation: "knowledge_documents"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"knowledge_documents": {
                  Row: {
                    "chunk_count": number,"content": string,"created_at": string,"created_by": string | null,"id": string,"knowledge_base_id": string,"tenant_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chunk_count"?: number,"content": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"knowledge_base_id": string,"tenant_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "chunk_count"?: number,"content"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"knowledge_base_id"?: string,"tenant_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_documents_tenant_id_knowledge_base_id_fkey"
      columns: ["tenant_id","knowledge_base_id"]
isOneToOne: false
      referencedRelation: "knowledge_bases"
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
                },"message_delivery_events": {
                  Row: {
                    "created_at": string,"errors": Json | null,"id": string,"occurred_at": string,"pricing": Json | null,"status": Database["public"]['Enums']["message_status"],"tenant_id": string,"wa_message_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"errors"?: Json | null,"id"?: string,"occurred_at": string,"pricing"?: Json | null,"status": Database["public"]['Enums']["message_status"],"tenant_id": string,"wa_message_id": string
                  }
                  Update: {
                    "created_at"?: string,"errors"?: Json | null,"id"?: string,"occurred_at"?: string,"pricing"?: Json | null,"status"?: Database["public"]['Enums']["message_status"],"tenant_id"?: string,"wa_message_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_delivery_events_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"message_send_requests": {
                  Row: {
                    "attempts": number,"body": string | null,"checks": NonNullable<Json>,"contact_id": string,"conversation_id": string | null,"created_at": string,"created_by": string | null,"decision": Database["public"]['Enums']["send_decision"],"error": string | null,"finished_at": string | null,"id": string,"idempotency_key": string,"kind": Database["public"]['Enums']["send_kind"],"origin": Database["public"]['Enums']["send_origin"],"phone_number_id": string,"proactive": boolean,"purpose": Database["public"]['Enums']["consent_purpose"] | null,"status": string,"template_id": string | null,"tenant_id": string,"wa_message_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body"?: string | null,"checks": NonNullable<Json>,"contact_id": string,"conversation_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"decision": Database["public"]['Enums']["send_decision"],"error"?: string | null,"finished_at"?: string | null,"id"?: string,"idempotency_key": string,"kind": Database["public"]['Enums']["send_kind"],"origin": Database["public"]['Enums']["send_origin"],"phone_number_id": string,"proactive"?: boolean,"purpose"?: Database["public"]['Enums']["consent_purpose"] | null,"status"?: string,"template_id"?: string | null,"tenant_id": string,"wa_message_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"body"?: string | null,"checks"?: NonNullable<Json>,"contact_id"?: string,"conversation_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"decision"?: Database["public"]['Enums']["send_decision"],"error"?: string | null,"finished_at"?: string | null,"id"?: string,"idempotency_key"?: string,"kind"?: Database["public"]['Enums']["send_kind"],"origin"?: Database["public"]['Enums']["send_origin"],"phone_number_id"?: string,"proactive"?: boolean,"purpose"?: Database["public"]['Enums']["consent_purpose"] | null,"status"?: string,"template_id"?: string | null,"tenant_id"?: string,"wa_message_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_send_requests_tenant_id_contact_id_fkey"
      columns: ["tenant_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "message_send_requests_tenant_id_conversation_id_fkey"
      columns: ["tenant_id","conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "message_send_requests_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_send_requests_tenant_id_phone_number_id_fkey"
      columns: ["tenant_id","phone_number_id"]
isOneToOne: false
      referencedRelation: "whatsapp_phone_numbers"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "message_send_requests_tenant_id_template_id_fkey"
      columns: ["tenant_id","template_id"]
isOneToOne: false
      referencedRelation: "whatsapp_templates"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string | null,"conversation_id": string,"created_at": string,"direction": Database["public"]['Enums']["message_direction"],"error": Json | null,"id": string,"media": Json | null,"occurred_at": string,"phone_number_id": string,"send_request_id": string | null,"sender_type": Database["public"]['Enums']["message_sender"],"sender_user_id": string | null,"status": Database["public"]['Enums']["message_status"],"template_name": string | null,"tenant_id": string,"type": string,"wa_message_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"conversation_id": string,"created_at"?: string,"direction": Database["public"]['Enums']["message_direction"],"error"?: Json | null,"id"?: string,"media"?: Json | null,"occurred_at"?: string,"phone_number_id": string,"send_request_id"?: string | null,"sender_type": Database["public"]['Enums']["message_sender"],"sender_user_id"?: string | null,"status": Database["public"]['Enums']["message_status"],"template_name"?: string | null,"tenant_id": string,"type"?: string,"wa_message_id"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"conversation_id"?: string,"created_at"?: string,"direction"?: Database["public"]['Enums']["message_direction"],"error"?: Json | null,"id"?: string,"media"?: Json | null,"occurred_at"?: string,"phone_number_id"?: string,"send_request_id"?: string | null,"sender_type"?: Database["public"]['Enums']["message_sender"],"sender_user_id"?: string | null,"status"?: Database["public"]['Enums']["message_status"],"template_name"?: string | null,"tenant_id"?: string,"type"?: string,"wa_message_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_tenant_id_conversation_id_fkey"
      columns: ["tenant_id","conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "messages_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_tenant_id_phone_number_id_fkey"
      columns: ["tenant_id","phone_number_id"]
isOneToOne: false
      referencedRelation: "whatsapp_phone_numbers"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "messages_tenant_id_send_request_id_fkey"
      columns: ["tenant_id","send_request_id"]
isOneToOne: false
      referencedRelation: "message_send_requests"
      referencedColumns: ["tenant_id","id"]
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
                    "evolution_daily_proactive_limit": number,"locale": string,"require_mfa": boolean,"sales_visibility": Database["public"]['Enums']["sales_visibility"],"tenant_id": string,"timezone": string,"updated_at": string,"updated_by": string | null,"viewer_can_read_conversations": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "evolution_daily_proactive_limit"?: number,"locale"?: string,"require_mfa"?: boolean,"sales_visibility"?: Database["public"]['Enums']["sales_visibility"],"tenant_id": string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"viewer_can_read_conversations"?: boolean
                  }
                  Update: {
                    "evolution_daily_proactive_limit"?: number,"locale"?: string,"require_mfa"?: boolean,"sales_visibility"?: Database["public"]['Enums']["sales_visibility"],"tenant_id"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"viewer_can_read_conversations"?: boolean
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
                    "active": boolean,"code": string,"created_at": string,"currency": string,"description": string | null,"entitlements": NonNullable<Json>,"is_public": boolean,"name": string,"price_is_final": boolean,"price_monthly_cents": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"currency"?: string,"description"?: string | null,"entitlements"?: NonNullable<Json>,"is_public"?: boolean,"name": string,"price_is_final"?: boolean,"price_monthly_cents"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"currency"?: string,"description"?: string | null,"entitlements"?: NonNullable<Json>,"is_public"?: boolean,"name"?: string,"price_is_final"?: boolean,"price_monthly_cents"?: number | null,"updated_at"?: string
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
                },"webhook_events": {
                  Row: {
                    "attempts": number,"dedupe_key": string,"id": string,"kind": string,"last_error": string | null,"payload": NonNullable<Json>,"phone_number_id": string | null,"processed_at": string | null,"provider": string,"received_at": string,"status": string,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"dedupe_key": string,"id"?: string,"kind": string,"last_error"?: string | null,"payload": NonNullable<Json>,"phone_number_id"?: string | null,"processed_at"?: string | null,"provider"?: string,"received_at"?: string,"status"?: string,"tenant_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"dedupe_key"?: string,"id"?: string,"kind"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"phone_number_id"?: string | null,"processed_at"?: string | null,"provider"?: string,"received_at"?: string,"status"?: string,"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_events_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_accounts": {
                  Row: {
                    "access_token_secret_id": string | null,"coexistence": boolean,"connected_at": string | null,"connected_by": string | null,"created_at": string,"display_name": string | null,"id": string,"last_error": string | null,"provider": Database["public"]['Enums']["whatsapp_provider"],"status": Database["public"]['Enums']["whatsapp_status"],"tenant_id": string,"token_last4": string | null,"updated_at": string,"waba_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_secret_id"?: string | null,"coexistence"?: boolean,"connected_at"?: string | null,"connected_by"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"last_error"?: string | null,"provider": Database["public"]['Enums']["whatsapp_provider"],"status"?: Database["public"]['Enums']["whatsapp_status"],"tenant_id": string,"token_last4"?: string | null,"updated_at"?: string,"waba_id"?: string | null
                  }
                  Update: {
                    "access_token_secret_id"?: string | null,"coexistence"?: boolean,"connected_at"?: string | null,"connected_by"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"last_error"?: string | null,"provider"?: Database["public"]['Enums']["whatsapp_provider"],"status"?: Database["public"]['Enums']["whatsapp_status"],"tenant_id"?: string,"token_last4"?: string | null,"updated_at"?: string,"waba_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_accounts_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_phone_numbers": {
                  Row: {
                    "account_id": string,"created_at": string,"display_phone": string,"id": string,"messaging_limit_tier": string | null,"phone_number_id": string,"quality_rating": string | null,"status": Database["public"]['Enums']["whatsapp_status"],"tenant_id": string,"updated_at": string,"verified_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"display_phone": string,"id"?: string,"messaging_limit_tier"?: string | null,"phone_number_id": string,"quality_rating"?: string | null,"status"?: Database["public"]['Enums']["whatsapp_status"],"tenant_id": string,"updated_at"?: string,"verified_name"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"display_phone"?: string,"id"?: string,"messaging_limit_tier"?: string | null,"phone_number_id"?: string,"quality_rating"?: string | null,"status"?: Database["public"]['Enums']["whatsapp_status"],"tenant_id"?: string,"updated_at"?: string,"verified_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_phone_numbers_tenant_id_account_id_fkey"
      columns: ["tenant_id","account_id"]
isOneToOne: false
      referencedRelation: "whatsapp_accounts"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"whatsapp_templates": {
                  Row: {
                    "account_id": string,"category": Database["public"]['Enums']["template_category"],"components": NonNullable<Json>,"id": string,"language": string,"meta_template_id": string | null,"name": string,"status": string,"synced_at": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"category": Database["public"]['Enums']["template_category"],"components"?: NonNullable<Json>,"id"?: string,"language": string,"meta_template_id"?: string | null,"name": string,"status": string,"synced_at"?: string,"tenant_id": string
                  }
                  Update: {
                    "account_id"?: string,"category"?: Database["public"]['Enums']["template_category"],"components"?: NonNullable<Json>,"id"?: string,"language"?: string,"meta_template_id"?: string | null,"name"?: string,"status"?: string,"synced_at"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_templates_tenant_id_account_id_fkey"
      columns: ["tenant_id","account_id"]
isOneToOne: false
      referencedRelation: "whatsapp_accounts"
      referencedColumns: ["tenant_id","id"]
    }
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
"campaign_build_audience":
{ Args: { "p_campaign": string,"p_tenant": string }; Returns: Json
                           },
"campaign_claim_recipients":
{ Args: { "p_campaign": string,"p_limit": number }; Returns: {
              "campaign_id": string,
"contact_id": string,
"detail": string | null,
"eligibility": string,
"exclusion_reason": string | null,
"id": string,
"processed_at": string | null,
"send_request_id": string | null,
"status": string,
"tenant_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "campaign_recipients"
        isOneToOne: false
        isSetofReturn: true
      } },
"campaign_transition":
{ Args: { "p_campaign": string,"p_emergency"?: boolean,"p_reason"?: string,"p_tenant": string,"p_to": Database["public"]['Enums']["campaign_status"] }; Returns: {
              "approved_at": string | null,
"approved_by": string | null,
"audience_built_at": string | null,
"audience_filter": NonNullable<Json>,
"created_at": string,
"created_by": string | null,
"daily_limit": number,
"eligible_count": number,
"emergency_stopped_at": string | null,
"excluded_count": number,
"hourly_limit": number,
"id": string,
"name": string,
"objective": string | null,
"phone_number_id": string,
"purpose": Database["public"]['Enums']["consent_purpose"],
"starts_at": string | null,
"status": Database["public"]['Enums']["campaign_status"],
"status_reason": string | null,
"template_id": string,
"template_parameters": NonNullable<Json>,
"tenant_id": string,
"total_limit": number,
"updated_at": string,
"window_end": string,
"window_start": string
            }
                          SetofOptions: {
        from: "*"
        to: "campaigns"
        isOneToOne: true
        isSetofReturn: false
      } },
"capture_form_submit":
{ Args: { "p_company": string,"p_consent": boolean,"p_consent_version": number,"p_email": string,"p_full_name": string,"p_ip_hash": string,"p_job_title": string,"p_message": string,"p_payload_hash": string,"p_phone_e164": string,"p_public_key": string,"p_user_agent": string }; Returns: Json
                           },
"company_apply_enrichment":
{ Args: { "p_company": string,"p_data": Json,"p_document": string,"p_status": Database["public"]['Enums']["enrichment_status"],"p_tenant": string }; Returns: {
              "applied_fields": (string)[],
"company_id": string | null,
"data": NonNullable<Json>,
"document": string,
"fetched_at": string,
"fetched_by": string | null,
"id": string,
"source": string,
"status": Database["public"]['Enums']["enrichment_status"],
"tenant_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "company_enrichments"
        isOneToOne: true
        isSetofReturn: false
      } },
"consume_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"create_agent_version":
{ Args: { "p_agent": string,"p_input_price": number,"p_knowledge_base_ids": (string)[],"p_max_output_tokens": number,"p_model": string,"p_notes"?: string,"p_output_price": number,"p_provider": string,"p_system_prompt": string,"p_tenant": string }; Returns: {
              "agent_id": string,
"created_at": string,
"created_by": string | null,
"id": string,
"input_price_per_mtok": number,
"knowledge_base_ids": (string)[],
"max_output_tokens": number,
"model": string,
"notes": string | null,
"output_price_per_mtok": number,
"provider": string,
"system_prompt": string,
"tenant_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "agent_versions"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"organization_usage":
{ Args: { "p_tenant": string }; Returns: {
              "kind": string,"limit_value": number,"metric": string,"reserved": number,"used": number
            }[]
                           },
"platform_create_invoice":
{ Args: { "p_actor": string,"p_amount_cents": number,"p_description": string,"p_due_date": string,"p_notes": string,"p_period_end": string,"p_period_start": string,"p_reason": string,"p_tenant": string }; Returns: string
                           },
"platform_create_organization":
{ Args: { "p_actor": string,"p_document"?: string,"p_legal_name"?: string,"p_name": string,"p_owner_email": string,"p_owner_token_hash": string,"p_plan_code"?: string,"p_reason"?: string,"p_slug": string }; Returns: string
                           },
"platform_integration_health":
{ Args: Record<PropertyKey, never>; Returns: {
              "agent_failed_24h": number,"agent_runs_24h": number,"campaigns_running": number,"last_webhook_at": string,"last_whatsapp_error": string,"tenant_id": string,"webhook_dead_letter_7d": number,"webhook_failed_7d": number,"webhook_pending_stale": number,"whatsapp_accounts": number,"whatsapp_with_error": number
            }[]
                           },
"platform_invite_owner":
{ Args: { "p_actor": string,"p_email": string,"p_reason"?: string,"p_tenant": string,"p_token_hash": string }; Returns: string
                           },
"platform_set_invoice_status":
{ Args: { "p_actor": string,"p_external_ref": string,"p_invoice": string,"p_payment_method": string,"p_reason": string,"p_status": Database["public"]['Enums']["invoice_status"] }; Returns: undefined
                           },
"platform_set_organization_status":
{ Args: { "p_actor": string,"p_reason": string,"p_status": Database["public"]['Enums']["org_status"],"p_tenant": string }; Returns: undefined
                           },
"platform_update_subscription":
{ Args: { "p_actor": string,"p_limit_overrides": Json,"p_notes": string,"p_period_end": string,"p_period_start": string,"p_plan_code": string,"p_reason": string,"p_status": Database["public"]['Enums']["subscription_status"],"p_tenant": string }; Returns: undefined
                           },
"platform_upsert_plan":
{ Args: { "p_active": boolean,"p_actor": string,"p_code": string,"p_description": string,"p_is_public": boolean,"p_limits": Json,"p_name": string,"p_price_is_final": boolean,"p_price_monthly_cents": number,"p_reason": string }; Returns: undefined
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
"search_knowledge":
{ Args: { "p_knowledge_base_ids": (string)[],"p_limit"?: number,"p_query": string,"p_tenant": string }; Returns: {
              "content": string,"document_id": string,"id": string,"rank": number,"title": string
            }[]
                           },
"settle_usage":
{ Args: { "p_actual": number,"p_reservation": string,"p_source_id"?: string,"p_source_type"?: string,"p_tenant": string }; Returns: undefined
                           },
"whatsapp_apply_status":
{ Args: { "p_errors": Json,"p_occurred_at": string,"p_pricing": Json,"p_status": Database["public"]['Enums']["message_status"],"p_wa_message_id": string }; Returns: string
                           },
"whatsapp_get_access_token":
{ Args: { "p_account": string }; Returns: string
                           },
"whatsapp_opt_out":
{ Args: { "p_contact": string,"p_source": string,"p_tenant": string }; Returns: undefined
                           },
"whatsapp_record_inbound":
{ Args: { "p_body": string,"p_from_e164": string,"p_media": Json,"p_occurred_at": string,"p_phone_number_id": string,"p_profile_name": string,"p_sender"?: Database["public"]['Enums']["message_sender"],"p_type": string,"p_wa_message_id": string }; Returns: Json
                           },
"whatsapp_send_gate":
{ Args: { "p_body"?: string,"p_campaign_active"?: boolean,"p_contact": string,"p_idempotency_key": string,"p_kind": Database["public"]['Enums']["send_kind"],"p_origin": Database["public"]['Enums']["send_origin"],"p_phone_number": string,"p_purpose"?: Database["public"]['Enums']["consent_purpose"],"p_template"?: string,"p_tenant": string }; Returns: {
              "attempts": number,
"body": string | null,
"checks": NonNullable<Json>,
"contact_id": string,
"conversation_id": string | null,
"created_at": string,
"created_by": string | null,
"decision": Database["public"]['Enums']["send_decision"],
"error": string | null,
"finished_at": string | null,
"id": string,
"idempotency_key": string,
"kind": Database["public"]['Enums']["send_kind"],
"origin": Database["public"]['Enums']["send_origin"],
"phone_number_id": string,
"proactive": boolean,
"purpose": Database["public"]['Enums']["consent_purpose"] | null,
"status": string,
"template_id": string | null,
"tenant_id": string,
"wa_message_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "message_send_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"whatsapp_set_access_token":
{ Args: { "p_account": string,"p_tenant": string,"p_token": string }; Returns: undefined
                           },
"whatsapp_set_connection_state":
{ Args: { "p_phone_number_id": string,"p_status": Database["public"]['Enums']["whatsapp_status"] }; Returns: undefined
                           }
          }
          Enums: {
            "activity_kind": "note"|"call"|"email"|"meeting"|"message"|"stage_change"|"consent_change"|"task"|"import"|"system","actor_type": "user"|"agent"|"system"|"platform_admin","agent_status": "active"|"inactive"|"testing","agent_type": "sdr"|"capture"|"followup"|"analyst","billing_mode": "manual"|"gateway","campaign_status": "draft"|"awaiting_approval"|"scheduled"|"running"|"paused"|"completed"|"canceled","capture_form_status": "draft"|"active"|"paused","consent_channel": "whatsapp"|"email"|"phone","consent_purpose": "marketing"|"sales_followup"|"service"|"transactional","consent_status": "granted"|"revoked","conversation_status": "open"|"pending_human"|"closed","discovery_stage": "company_identified"|"contact_found"|"contact_authorized"|"qualified_opportunity","enrichment_status": "success"|"not_found"|"error","execution_status": "running"|"succeeded"|"failed"|"skipped","invoice_status": "draft"|"issued"|"paid"|"canceled","lead_qualification": "unknown"|"cold"|"warm"|"hot","lead_source_kind": "manual"|"form"|"csv"|"ads"|"api"|"research"|"whatsapp_inbound"|"referral","legal_basis": "consent"|"legitimate_interest"|"contract"|"legal_obligation","member_status": "active"|"disabled","message_direction": "inbound"|"outbound","message_sender": "contact"|"user"|"agent"|"system"|"business_app","message_status": "received"|"queued"|"sent"|"delivered"|"read"|"failed","opportunity_status": "open"|"won"|"lost","org_role": "viewer"|"sales"|"manager"|"admin"|"owner","org_status": "active"|"suspended"|"closed","reservation_status": "reserved"|"settled"|"released","sales_visibility": "all"|"assigned","send_decision": "allowed"|"blocked","send_kind": "free_text"|"template","send_origin": "user"|"agent"|"campaign"|"followup"|"system","subscription_status": "trial"|"active"|"past_due"|"canceled"|"internal","suppression_reason": "opt_out"|"complaint"|"blocked"|"invalid"|"legal_request","task_status": "open"|"done"|"canceled","template_category": "marketing"|"utility"|"authentication","tool_decision": "executed"|"rejected"|"needs_approval","whatsapp_provider": "meta_cloud"|"sandbox"|"evolution","whatsapp_status": "pending"|"syncing"|"active"|"disconnected"|"error"
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
            "activity_kind": ["note", "call", "email", "meeting", "message", "stage_change", "consent_change", "task", "import", "system"],"actor_type": ["user", "agent", "system", "platform_admin"],"agent_status": ["active", "inactive", "testing"],"agent_type": ["sdr", "capture", "followup", "analyst"],"billing_mode": ["manual", "gateway"],"campaign_status": ["draft", "awaiting_approval", "scheduled", "running", "paused", "completed", "canceled"],"capture_form_status": ["draft", "active", "paused"],"consent_channel": ["whatsapp", "email", "phone"],"consent_purpose": ["marketing", "sales_followup", "service", "transactional"],"consent_status": ["granted", "revoked"],"conversation_status": ["open", "pending_human", "closed"],"discovery_stage": ["company_identified", "contact_found", "contact_authorized", "qualified_opportunity"],"enrichment_status": ["success", "not_found", "error"],"execution_status": ["running", "succeeded", "failed", "skipped"],"invoice_status": ["draft", "issued", "paid", "canceled"],"lead_qualification": ["unknown", "cold", "warm", "hot"],"lead_source_kind": ["manual", "form", "csv", "ads", "api", "research", "whatsapp_inbound", "referral"],"legal_basis": ["consent", "legitimate_interest", "contract", "legal_obligation"],"member_status": ["active", "disabled"],"message_direction": ["inbound", "outbound"],"message_sender": ["contact", "user", "agent", "system", "business_app"],"message_status": ["received", "queued", "sent", "delivered", "read", "failed"],"opportunity_status": ["open", "won", "lost"],"org_role": ["viewer", "sales", "manager", "admin", "owner"],"org_status": ["active", "suspended", "closed"],"reservation_status": ["reserved", "settled", "released"],"sales_visibility": ["all", "assigned"],"send_decision": ["allowed", "blocked"],"send_kind": ["free_text", "template"],"send_origin": ["user", "agent", "campaign", "followup", "system"],"subscription_status": ["trial", "active", "past_due", "canceled", "internal"],"suppression_reason": ["opt_out", "complaint", "blocked", "invalid", "legal_request"],"task_status": ["open", "done", "canceled"],"template_category": ["marketing", "utility", "authentication"],"tool_decision": ["executed", "rejected", "needs_approval"],"whatsapp_provider": ["meta_cloud", "sandbox", "evolution"],"whatsapp_status": ["pending", "syncing", "active", "disconnected", "error"]
          }
        }
} as const
