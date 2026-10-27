// Gerado por `npm run db:types` (supabase gen types). Não editar à mão.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"role": Database["public"]['Enums']["admin_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"role": Database["public"]['Enums']["admin_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"role"?: Database["public"]['Enums']["admin_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"news_agent_models": {
                  Row: {
                    "agent_name": string,"enabled": boolean,"input_price_per_mtok": number,"max_output_tokens": number,"model": string,"output_price_per_mtok": number,"provider": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_name": string,"enabled"?: boolean,"input_price_per_mtok": number,"max_output_tokens"?: number,"model": string,"output_price_per_mtok": number,"provider"?: string,"updated_at"?: string
                  }
                  Update: {
                    "agent_name"?: string,"enabled"?: boolean,"input_price_per_mtok"?: number,"max_output_tokens"?: number,"model"?: string,"output_price_per_mtok"?: number,"provider"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"news_agent_runs": {
                  Row: {
                    "actual_cost_if_available": number | null,"agent_name": string,"error_details": Json | null,"estimated_cost": number,"finished_at": string | null,"id": string,"idempotency_key": string | null,"input_reference": NonNullable<Json>,"latency_ms": number | null,"model": string | null,"output_reference": Json | null,"provider": string | null,"run_id": string | null,"started_at": string,"status": Database["public"]['Enums']["news_run_status"],"token_usage": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_cost_if_available"?: number | null,"agent_name": string,"error_details"?: Json | null,"estimated_cost"?: number,"finished_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"input_reference"?: NonNullable<Json>,"latency_ms"?: number | null,"model"?: string | null,"output_reference"?: Json | null,"provider"?: string | null,"run_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["news_run_status"],"token_usage"?: Json | null
                  }
                  Update: {
                    "actual_cost_if_available"?: number | null,"agent_name"?: string,"error_details"?: Json | null,"estimated_cost"?: number,"finished_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"input_reference"?: NonNullable<Json>,"latency_ms"?: number | null,"model"?: string | null,"output_reference"?: Json | null,"provider"?: string | null,"run_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["news_run_status"],"token_usage"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"news_articles": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"candidate_id": string | null,"category_id": string | null,"content": string,"cover_image_alt": string | null,"cover_image_credit": string | null,"cover_image_url": string | null,"created_at": string,"excerpt": string,"id": string,"original_sources": NonNullable<Json>,"published_at": string | null,"review_notes": string | null,"risk_level": Database["public"]['Enums']["news_risk_level"],"scheduled_for": string | null,"search_vector": unknown,"seo_metadata": NonNullable<Json>,"slug": string,"status": Database["public"]['Enums']["news_article_status"],"subtitle": string | null,"title": string,"updated_at": string,"verification_status": Database["public"]['Enums']["news_verification_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"candidate_id"?: string | null,"category_id"?: string | null,"content": string,"cover_image_alt"?: string | null,"cover_image_credit"?: string | null,"cover_image_url"?: string | null,"created_at"?: string,"excerpt": string,"id"?: string,"original_sources"?: NonNullable<Json>,"published_at"?: string | null,"review_notes"?: string | null,"risk_level"?: Database["public"]['Enums']["news_risk_level"],"scheduled_for"?: string | null,"search_vector"?: never,"seo_metadata"?: NonNullable<Json>,"slug": string,"status"?: Database["public"]['Enums']["news_article_status"],"subtitle"?: string | null,"title": string,"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["news_verification_status"]
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"candidate_id"?: string | null,"category_id"?: string | null,"content"?: string,"cover_image_alt"?: string | null,"cover_image_credit"?: string | null,"cover_image_url"?: string | null,"created_at"?: string,"excerpt"?: string,"id"?: string,"original_sources"?: NonNullable<Json>,"published_at"?: string | null,"review_notes"?: string | null,"risk_level"?: Database["public"]['Enums']["news_risk_level"],"scheduled_for"?: string | null,"search_vector"?: never,"seo_metadata"?: NonNullable<Json>,"slug"?: string,"status"?: Database["public"]['Enums']["news_article_status"],"subtitle"?: string | null,"title"?: string,"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["news_verification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "news_articles_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: true
      referencedRelation: "news_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "news_articles_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "news_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"news_audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": Database["public"]['Enums']["news_actor_type"],"after_state": Json | null,"before_state": Json | null,"entity_id": string | null,"entity_type": string,"id": number,"timestamp": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": Database["public"]['Enums']["news_actor_type"],"after_state"?: Json | null,"before_state"?: Json | null,"entity_id"?: string | null,"entity_type": string,"id"?: never,"timestamp"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["news_actor_type"],"after_state"?: Json | null,"before_state"?: Json | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"timestamp"?: string
                  }
                  Relationships: [
                    
                  ]
                },"news_candidates": {
                  Row: {
                    "attempts": number,"canonical_url": string,"created_at": string,"duplicate_of": string | null,"fetched_at": string,"fingerprint": string,"id": string,"last_error": string | null,"locked_until": string | null,"metadata": NonNullable<Json>,"original_title": string,"original_url": string,"processing_status": Database["public"]['Enums']["news_processing_status"],"relevance_reason": string | null,"relevance_score": number | null,"source_id": string,"source_published_at": string | null,"summary": string | null,"title_tokens": (string)[],"updated_at": string,"verification_status": Database["public"]['Enums']["news_verification_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"canonical_url": string,"created_at"?: string,"duplicate_of"?: string | null,"fetched_at"?: string,"fingerprint": string,"id"?: string,"last_error"?: string | null,"locked_until"?: string | null,"metadata"?: NonNullable<Json>,"original_title": string,"original_url": string,"processing_status"?: Database["public"]['Enums']["news_processing_status"],"relevance_reason"?: string | null,"relevance_score"?: number | null,"source_id": string,"source_published_at"?: string | null,"summary"?: string | null,"title_tokens"?: (string)[],"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["news_verification_status"]
                  }
                  Update: {
                    "attempts"?: number,"canonical_url"?: string,"created_at"?: string,"duplicate_of"?: string | null,"fetched_at"?: string,"fingerprint"?: string,"id"?: string,"last_error"?: string | null,"locked_until"?: string | null,"metadata"?: NonNullable<Json>,"original_title"?: string,"original_url"?: string,"processing_status"?: Database["public"]['Enums']["news_processing_status"],"relevance_reason"?: string | null,"relevance_score"?: number | null,"source_id"?: string,"source_published_at"?: string | null,"summary"?: string | null,"title_tokens"?: (string)[],"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["news_verification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "news_candidates_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "news_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "news_candidates_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "news_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"news_categories": {
                  Row: {
                    "created_at": string,"description": string | null,"enabled": boolean,"id": string,"name": string,"priority": number,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"enabled"?: boolean,"id"?: string,"name": string,"priority"?: number,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"enabled"?: boolean,"id"?: string,"name"?: string,"priority"?: number,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"news_claim_evidence": {
                  Row: {
                    "claim_id": string,"id": string,"is_independent": boolean,"quote": string | null,"retrieved_at": string,"source_title": string | null,"source_url": string,"supports": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_id": string,"id"?: string,"is_independent"?: boolean,"quote"?: string | null,"retrieved_at"?: string,"source_title"?: string | null,"source_url": string,"supports": boolean
                  }
                  Update: {
                    "claim_id"?: string,"id"?: string,"is_independent"?: boolean,"quote"?: string | null,"retrieved_at"?: string,"source_title"?: string | null,"source_url"?: string,"supports"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "news_claim_evidence_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "news_claims"
      referencedColumns: ["id"]
    }
                  ]
                },"news_claims": {
                  Row: {
                    "article_id": string,"checker_notes": string | null,"claim": string,"confidence": number | null,"created_at": string,"id": string,"status": Database["public"]['Enums']["news_claim_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "article_id": string,"checker_notes"?: string | null,"claim": string,"confidence"?: number | null,"created_at"?: string,"id"?: string,"status": Database["public"]['Enums']["news_claim_status"]
                  }
                  Update: {
                    "article_id"?: string,"checker_notes"?: string | null,"claim"?: string,"confidence"?: number | null,"created_at"?: string,"id"?: string,"status"?: Database["public"]['Enums']["news_claim_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "news_claims_article_id_fkey"
      columns: ["article_id"]
isOneToOne: false
      referencedRelation: "news_articles"
      referencedColumns: ["id"]
    }
                  ]
                },"news_editorial_settings": {
                  Row: {
                    "allowed_categories": (string)[] | null,"approval_required": boolean,"auto_publish_enabled": boolean,"automation_paused": boolean,"daily_publication_limit": number,"enabled_sources": (string)[] | null,"id": number,"max_candidates_per_run": number,"min_relevance_score": number,"monthly_cost_limit": number,"schedule_times": (string)[],"source_images_enabled": boolean,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_categories"?: (string)[] | null,"approval_required"?: boolean,"auto_publish_enabled"?: boolean,"automation_paused"?: boolean,"daily_publication_limit"?: number,"enabled_sources"?: (string)[] | null,"id"?: number,"max_candidates_per_run"?: number,"min_relevance_score"?: number,"monthly_cost_limit"?: number,"schedule_times"?: (string)[],"source_images_enabled"?: boolean,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allowed_categories"?: (string)[] | null,"approval_required"?: boolean,"auto_publish_enabled"?: boolean,"automation_paused"?: boolean,"daily_publication_limit"?: number,"enabled_sources"?: (string)[] | null,"id"?: number,"max_candidates_per_run"?: number,"min_relevance_score"?: number,"monthly_cost_limit"?: number,"schedule_times"?: (string)[],"source_images_enabled"?: boolean,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"news_sources": {
                  Row: {
                    "category_id": string | null,"consecutive_failures": number,"created_at": string,"enabled": boolean,"feed_url": string,"id": string,"last_error": string | null,"last_fetched_at": string | null,"last_status": string | null,"name": string,"trust_level": Database["public"]['Enums']["news_trust_level"],"updated_at": string,"website_url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"consecutive_failures"?: number,"created_at"?: string,"enabled"?: boolean,"feed_url": string,"id"?: string,"last_error"?: string | null,"last_fetched_at"?: string | null,"last_status"?: string | null,"name": string,"trust_level"?: Database["public"]['Enums']["news_trust_level"],"updated_at"?: string,"website_url": string
                  }
                  Update: {
                    "category_id"?: string | null,"consecutive_failures"?: number,"created_at"?: string,"enabled"?: boolean,"feed_url"?: string,"id"?: string,"last_error"?: string | null,"last_fetched_at"?: string | null,"last_status"?: string | null,"name"?: string,"trust_level"?: Database["public"]['Enums']["news_trust_level"],"updated_at"?: string,"website_url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "news_sources_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "news_categories"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "current_admin_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["admin_role"]
                           },
"is_news_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_news_editor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_service_role":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"news_claim_candidate":
{ Args: { "p_candidate_id": string,"p_lease_seconds"?: number }; Returns: boolean
                           },
"news_dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"news_publish_article":
{ Args: { "p_article_id": string,"p_mode"?: string }; Returns: {
              "approved_at": string | null,
"approved_by": string | null,
"candidate_id": string | null,
"category_id": string | null,
"content": string,
"cover_image_alt": string | null,
"cover_image_credit": string | null,
"cover_image_url": string | null,
"created_at": string,
"excerpt": string,
"id": string,
"original_sources": NonNullable<Json>,
"published_at": string | null,
"review_notes": string | null,
"risk_level": Database["public"]['Enums']["news_risk_level"],
"scheduled_for": string | null,
"search_vector": unknown,
"seo_metadata": NonNullable<Json>,
"slug": string,
"status": Database["public"]['Enums']["news_article_status"],
"subtitle": string | null,
"title": string,
"updated_at": string,
"verification_status": Database["public"]['Enums']["news_verification_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "news_articles"
        isOneToOne: true
        isSetofReturn: false
      } },
"news_start_agent_run":
{ Args: { "p_agent_name": string,"p_estimated_cost": number,"p_idempotency_key"?: string,"p_input_reference"?: Json,"p_model"?: string,"p_provider"?: string,"p_run_id"?: string }; Returns: string
                           }
          }
          Enums: {
            "admin_role": "admin"|"editor","news_actor_type": "user"|"agent"|"system","news_article_status": "draft"|"needs_review"|"blocked"|"approved"|"scheduled"|"published"|"rejected"|"archived","news_claim_status": "supported"|"partially_supported"|"unsupported"|"contradicted","news_processing_status": "new"|"classified"|"duplicate"|"discarded"|"eligible"|"drafted"|"failed"|"dead_letter","news_risk_level": "low"|"medium"|"high","news_run_status": "running"|"succeeded"|"failed"|"skipped","news_trust_level": "official"|"high"|"medium"|"low","news_verification_status": "pending"|"verified"|"partially_verified"|"unverified"|"blocked"
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
            "admin_role": ["admin", "editor"],"news_actor_type": ["user", "agent", "system"],"news_article_status": ["draft", "needs_review", "blocked", "approved", "scheduled", "published", "rejected", "archived"],"news_claim_status": ["supported", "partially_supported", "unsupported", "contradicted"],"news_processing_status": ["new", "classified", "duplicate", "discarded", "eligible", "drafted", "failed", "dead_letter"],"news_risk_level": ["low", "medium", "high"],"news_run_status": ["running", "succeeded", "failed", "skipped"],"news_trust_level": ["official", "high", "medium", "low"],"news_verification_status": ["pending", "verified", "partially_verified", "unverified", "blocked"]
          }
        }
} as const
