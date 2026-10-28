// Gerado por `npm run db:sales:types` (supabase gen types, projeto AI Sales). Não editar à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
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
            [_ in never]: never
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
"effective_limit":
{ Args: { "p_metric": string,"p_tenant": string }; Returns: number
                           },
"get_invite_preview":
{ Args: { "p_token_hash": string }; Returns: {
              "email": string,"expires_at": string,"organization_name": string,"organization_slug": string,"role": Database["public"]['Enums']["org_role"]
            }[]
                           },
"platform_create_organization":
{ Args: { "p_actor": string,"p_document"?: string,"p_legal_name"?: string,"p_name": string,"p_owner_email": string,"p_owner_token_hash": string,"p_plan_code"?: string,"p_reason"?: string,"p_slug": string }; Returns: string
                           },
"platform_invite_owner":
{ Args: { "p_actor": string,"p_email": string,"p_reason"?: string,"p_tenant": string,"p_token_hash": string }; Returns: string
                           },
"platform_set_organization_status":
{ Args: { "p_actor": string,"p_reason": string,"p_status": Database["public"]['Enums']["org_status"],"p_tenant": string }; Returns: undefined
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
            "actor_type": "user"|"agent"|"system"|"platform_admin","billing_mode": "manual"|"gateway","member_status": "active"|"disabled","org_role": "viewer"|"sales"|"manager"|"admin"|"owner","org_status": "active"|"suspended"|"closed","reservation_status": "reserved"|"settled"|"released","sales_visibility": "all"|"assigned","subscription_status": "trial"|"active"|"past_due"|"canceled"|"internal"
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
            "actor_type": ["user", "agent", "system", "platform_admin"],"billing_mode": ["manual", "gateway"],"member_status": ["active", "disabled"],"org_role": ["viewer", "sales", "manager", "admin", "owner"],"org_status": ["active", "suspended", "closed"],"reservation_status": ["reserved", "settled", "released"],"sales_visibility": ["all", "assigned"],"subscription_status": ["trial", "active", "past_due", "canceled", "internal"]
          }
        }
} as const
