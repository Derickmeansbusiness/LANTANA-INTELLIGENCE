
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounts": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"is_demo": boolean,"name": string,"type": string,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_events": {
                  Row: {
                    "actor_id": string | null,"deal_id": string | null,"entity_id": string | null,"entity_type": string,"id": number,"is_demo": boolean,"occurred_at": string,"scope": Database["public"]['Enums']["activity_scope"],"summary": string,"user_ids": (string)[],"verb": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"deal_id"?: string | null,"entity_id"?: string | null,"entity_type": string,"id"?: never,"is_demo"?: boolean,"occurred_at"?: string,"scope": Database["public"]['Enums']["activity_scope"],"summary": string,"user_ids"?: (string)[],"verb": string
                  }
                  Update: {
                    "actor_id"?: string | null,"deal_id"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"is_demo"?: boolean,"occurred_at"?: string,"scope"?: Database["public"]['Enums']["activity_scope"],"summary"?: string,"user_ids"?: (string)[],"verb"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"before": Json | null,"context": NonNullable<Json>,"id": number,"occurred_at": string,"row_id": string | null,"table_name": string | null
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"context"?: NonNullable<Json>,"id"?: never,"occurred_at"?: string,"row_id"?: string | null,"table_name"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"context"?: NonNullable<Json>,"id"?: never,"occurred_at"?: string,"row_id"?: string | null,"table_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"bank_accounts": {
                  Row: {
                    "bank_name": string | null,"created_at": string,"created_by": string | null,"currency": string,"deleted_at": string | null,"iban_encrypted": string | null,"iban_last4": string | null,"id": string,"is_demo": boolean,"name": string,"opening_balance_minor": number,"opening_date": string,"updated_at": string
                  }
                  Insert: {
                    "bank_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"deleted_at"?: string | null,"iban_encrypted"?: string | null,"iban_last4"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"opening_balance_minor"?: number,"opening_date": string,"updated_at"?: string
                  }
                  Update: {
                    "bank_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"iban_encrypted"?: string | null,"iban_last4"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"opening_balance_minor"?: number,"opening_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_accounts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_accounts_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"company": {
                  Row: {
                    "address_lines": (string)[],"base_currency": string,"created_at": string,"id": boolean,"legal_name": string,"licence_no": string | null,"licensing_authority": string | null,"require_principal_mfa": boolean,"timezone": string,"updated_at": string,"website": string | null
                  }
                  Insert: {
                    "address_lines"?: (string)[],"base_currency"?: string,"created_at"?: string,"id"?: boolean,"legal_name": string,"licence_no"?: string | null,"licensing_authority"?: string | null,"require_principal_mfa"?: boolean,"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "address_lines"?: (string)[],"base_currency"?: string,"created_at"?: string,"id"?: boolean,"legal_name"?: string,"licence_no"?: string | null,"licensing_authority"?: string | null,"require_principal_mfa"?: boolean,"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"compliance_items": {
                  Row: {
                    "authority": string | null,"category": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"due_date": string | null,"id": string,"is_demo": boolean,"notes": string | null,"owner_id": string | null,"recurrence": string | null,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "authority"?: string | null,"category": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"owner_id"?: string | null,"recurrence"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "authority"?: string | null,"category"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"owner_id"?: string | null,"recurrence"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "compliance_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compliance_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "country": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string | null,"full_name": string,"id": string,"is_demo": boolean,"job_title": string | null,"notes": string | null,"organization_id": string | null,"phone": string | null,"updated_at": string
                  }
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"is_demo"?: boolean,"job_title"?: string | null,"notes"?: string | null,"organization_id"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_demo"?: boolean,"job_title"?: string | null,"notes"?: string | null,"organization_id"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_country_fkey"
      columns: ["country"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "contacts_country_fkey"
      columns: ["country"]
isOneToOne: false
      referencedRelation: "v_deals_by_country"
      referencedColumns: ["country"]
    },{
      foreignKeyName: "contacts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_obligations": {
                  Row: {
                    "contract_id": string,"created_at": string,"created_by": string | null,"description": string,"due_date": string | null,"id": string,"is_demo": boolean,"owner_id": string | null,"status": string,"task_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "contract_id": string,"created_at"?: string,"created_by"?: string | null,"description": string,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"owner_id"?: string | null,"status"?: string,"task_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"owner_id"?: string | null,"status"?: string,"task_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_obligations_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_obligations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_obligations_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_obligations_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_survival_clauses": {
                  Row: {
                    "clause": string,"contract_id": string,"created_at": string,"created_by": string | null,"id": string,"is_demo": boolean,"survival_months": number
                  }
                  Insert: {
                    "clause": string,"contract_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"survival_months": number
                  }
                  Update: {
                    "clause"?: string,"contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"survival_months"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_survival_clauses_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_survival_clauses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "contract_type": Database["public"]['Enums']["contract_type"],"counterparty_address_confirmed": boolean,"counterparty_org_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document_id": string | null,"effective_date": string | null,"end_date": string | null,"esign_status": string | null,"exclusivity": string | null,"fee_terms": string | null,"forum": string | null,"governing_law": string | null,"id": string,"is_demo": boolean,"notes": string | null,"notice_period_days": number | null,"renewal_type": Database["public"]['Enums']["renewal_type"],"signatory_confirmed": boolean,"signatory_name": string | null,"signing_authority_confirmed": boolean,"status": Database["public"]['Enums']["contract_status"],"term_months": number | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "contract_type": Database["public"]['Enums']["contract_type"],"counterparty_address_confirmed"?: boolean,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"effective_date"?: string | null,"end_date"?: string | null,"esign_status"?: string | null,"exclusivity"?: string | null,"fee_terms"?: string | null,"forum"?: string | null,"governing_law"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"notice_period_days"?: number | null,"renewal_type"?: Database["public"]['Enums']["renewal_type"],"signatory_confirmed"?: boolean,"signatory_name"?: string | null,"signing_authority_confirmed"?: boolean,"status"?: Database["public"]['Enums']["contract_status"],"term_months"?: number | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "contract_type"?: Database["public"]['Enums']["contract_type"],"counterparty_address_confirmed"?: boolean,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"effective_date"?: string | null,"end_date"?: string | null,"esign_status"?: string | null,"exclusivity"?: string | null,"fee_terms"?: string | null,"forum"?: string | null,"governing_law"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"notice_period_days"?: number | null,"renewal_type"?: Database["public"]['Enums']["renewal_type"],"signatory_confirmed"?: boolean,"signatory_name"?: string | null,"signing_authority_confirmed"?: boolean,"status"?: Database["public"]['Enums']["contract_status"],"term_months"?: number | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_counterparty_org_id_fkey"
      columns: ["counterparty_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"countries": {
                  Row: {
                    "code": string,"name": string,"region": string
                  }
                  Insert: {
                    "code": string,"name": string,"region": string
                  }
                  Update: {
                    "code"?: string,"name"?: string,"region"?: string
                  }
                  Relationships: [
                    
                  ]
                },"currencies": {
                  Row: {
                    "code": string,"minor_unit": number,"name": string,"symbol": string | null
                  }
                  Insert: {
                    "code": string,"minor_unit": number,"name": string,"symbol"?: string | null
                  }
                  Update: {
                    "code"?: string,"minor_unit"?: number,"name"?: string,"symbol"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"deal_members": {
                  Row: {
                    "created_at": string,"deal_id": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"deal_id": string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"deal_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deal_members_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deal_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"deal_parties": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deal_id": string,"id": string,"is_demo": boolean,"notes": string | null,"organization_id": string,"role": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deal_id": string,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"organization_id": string,"role": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deal_id"?: string,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"organization_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deal_parties_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deal_parties_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deal_parties_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"deal_stage_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"deal_id": string,"from_stage": string | null,"id": number,"is_demo": boolean,"note": string | null,"to_stage": string
                  }
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"deal_id": string,"from_stage"?: string | null,"id"?: never,"is_demo"?: boolean,"note"?: string | null,"to_stage": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"deal_id"?: string,"from_stage"?: string | null,"id"?: never,"is_demo"?: boolean,"note"?: string | null,"to_stage"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deal_stage_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deal_stage_history_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deal_stage_history_from_stage_fkey"
      columns: ["from_stage"]
isOneToOne: false
      referencedRelation: "pipeline_stages"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "deal_stage_history_from_stage_fkey"
      columns: ["from_stage"]
isOneToOne: false
      referencedRelation: "v_pipeline_by_stage"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "deal_stage_history_to_stage_fkey"
      columns: ["to_stage"]
isOneToOne: false
      referencedRelation: "pipeline_stages"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "deal_stage_history_to_stage_fkey"
      columns: ["to_stage"]
isOneToOne: false
      referencedRelation: "v_pipeline_by_stage"
      referencedColumns: ["key"]
    }
                  ]
                },"deals": {
                  Row: {
                    "country": string | null,"created_at": string,"created_by": string | null,"currency": string,"deleted_at": string | null,"fee_pct": number | null,"fee_terms": string | null,"id": string,"introducer_org_id": string | null,"is_demo": boolean,"last_activity_at": string,"name": string,"next_step": string | null,"next_step_due": string | null,"owner_id": string | null,"probability": number | null,"project_owner_org_id": string | null,"search": unknown,"sector": Database["public"]['Enums']["sector"],"spv_planned": boolean,"stage": string,"summary": string | null,"ticket_minor": number | null,"updated_at": string
                  }
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"fee_pct"?: number | null,"fee_terms"?: string | null,"id"?: string,"introducer_org_id"?: string | null,"is_demo"?: boolean,"last_activity_at"?: string,"name": string,"next_step"?: string | null,"next_step_due"?: string | null,"owner_id"?: string | null,"probability"?: number | null,"project_owner_org_id"?: string | null,"search"?: never,"sector": Database["public"]['Enums']["sector"],"spv_planned"?: boolean,"stage"?: string,"summary"?: string | null,"ticket_minor"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"fee_pct"?: number | null,"fee_terms"?: string | null,"id"?: string,"introducer_org_id"?: string | null,"is_demo"?: boolean,"last_activity_at"?: string,"name"?: string,"next_step"?: string | null,"next_step_due"?: string | null,"owner_id"?: string | null,"probability"?: number | null,"project_owner_org_id"?: string | null,"search"?: never,"sector"?: Database["public"]['Enums']["sector"],"spv_planned"?: boolean,"stage"?: string,"summary"?: string | null,"ticket_minor"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deals_country_fkey"
      columns: ["country"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "deals_country_fkey"
      columns: ["country"]
isOneToOne: false
      referencedRelation: "v_deals_by_country"
      referencedColumns: ["country"]
    },{
      foreignKeyName: "deals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deals_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "deals_introducer_org_id_fkey"
      columns: ["introducer_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deals_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deals_project_owner_org_id_fkey"
      columns: ["project_owner_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deals_stage_fkey"
      columns: ["stage"]
isOneToOne: false
      referencedRelation: "pipeline_stages"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "deals_stage_fkey"
      columns: ["stage"]
isOneToOne: false
      referencedRelation: "v_pipeline_by_stage"
      referencedColumns: ["key"]
    }
                  ]
                },"document_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_id": string,"entity_id": string,"entity_type": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_id": string,"entity_id": string,"entity_type": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string,"entity_id"?: string,"entity_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_links_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"document_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_id": string,"file_name": string,"id": string,"is_demo": boolean,"mime_type": string | null,"sha256": string | null,"size_bytes": number | null,"storage_path": string,"version_no": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_id": string,"file_name": string,"id"?: string,"is_demo"?: boolean,"mime_type"?: string | null,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path": string,"version_no": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string,"file_name"?: string,"id"?: string,"is_demo"?: boolean,"mime_type"?: string | null,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_versions_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "checked_out_by": string | null,"confidentiality": Database["public"]['Enums']["confidentiality"],"created_at": string,"created_by": string | null,"current_version_id": string | null,"deleted_at": string | null,"description": string | null,"doc_type": string,"expiry_date": string | null,"folder_id": string | null,"id": string,"is_demo": boolean,"search": unknown,"status": Database["public"]['Enums']["document_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "checked_out_by"?: string | null,"confidentiality"?: Database["public"]['Enums']["confidentiality"],"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"doc_type"?: string,"expiry_date"?: string | null,"folder_id"?: string | null,"id"?: string,"is_demo"?: boolean,"search"?: never,"status"?: Database["public"]['Enums']["document_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "checked_out_by"?: string | null,"confidentiality"?: Database["public"]['Enums']["confidentiality"],"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"doc_type"?: string,"expiry_date"?: string | null,"folder_id"?: string | null,"id"?: string,"is_demo"?: boolean,"search"?: never,"status"?: Database["public"]['Enums']["document_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_checked_out_by_fkey"
      columns: ["checked_out_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "document_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"folders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"is_demo": boolean,"name": string,"parent_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"parent_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"parent_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "folders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"fx_rates": {
                  Row: {
                    "base": string,"created_at": string,"created_by": string | null,"id": string,"is_demo": boolean,"quote": string,"rate": number,"rate_date": string,"source": string
                  }
                  Insert: {
                    "base": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"quote": string,"rate": number,"rate_date": string,"source"?: string
                  }
                  Update: {
                    "base"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"quote"?: string,"rate"?: number,"rate_date"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fx_rates_base_fkey"
      columns: ["base"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "fx_rates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fx_rates_quote_fkey"
      columns: ["quote"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"introductions": {
                  Row: {
                    "channel": string,"corrects_id": string | null,"deal_id": string | null,"evidence_document_id": string | null,"id": string,"introduced_on": string,"is_demo": boolean,"party_a_contact_id": string | null,"party_a_org_id": string,"party_b_contact_id": string | null,"party_b_org_id": string,"prev_hash": string | null,"recorded_at": string,"recorded_by": string | null,"row_hash": string,"seq": number,"summary": string
                  }
                  Insert: {
                    "channel": string,"corrects_id"?: string | null,"deal_id"?: string | null,"evidence_document_id"?: string | null,"id"?: string,"introduced_on": string,"is_demo"?: boolean,"party_a_contact_id"?: string | null,"party_a_org_id": string,"party_b_contact_id"?: string | null,"party_b_org_id": string,"prev_hash"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"row_hash": string,"seq"?: never,"summary": string
                  }
                  Update: {
                    "channel"?: string,"corrects_id"?: string | null,"deal_id"?: string | null,"evidence_document_id"?: string | null,"id"?: string,"introduced_on"?: string,"is_demo"?: boolean,"party_a_contact_id"?: string | null,"party_a_org_id"?: string,"party_b_contact_id"?: string | null,"party_b_org_id"?: string,"prev_hash"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"row_hash"?: string,"seq"?: never,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "introductions_corrects_id_fkey"
      columns: ["corrects_id"]
isOneToOne: false
      referencedRelation: "introductions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "introductions_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "introductions_evidence_fk"
      columns: ["evidence_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "introductions_party_a_contact_id_fkey"
      columns: ["party_a_contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "introductions_party_a_org_id_fkey"
      columns: ["party_a_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "introductions_party_b_contact_id_fkey"
      columns: ["party_b_contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "introductions_party_b_org_id_fkey"
      columns: ["party_b_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "introductions_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"deal_id": string | null,"deleted_at": string | null,"due_date": string,"id": string,"invoice_no": string,"is_demo": boolean,"issue_date": string,"kind": string,"organization_id": string | null,"paid_at": string | null,"status": string,"total_minor": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"deal_id"?: string | null,"deleted_at"?: string | null,"due_date": string,"id"?: string,"invoice_no": string,"is_demo"?: boolean,"issue_date": string,"kind"?: string,"organization_id"?: string | null,"paid_at"?: string | null,"status"?: string,"total_minor": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"deal_id"?: string | null,"deleted_at"?: string | null,"due_date"?: string,"id"?: string,"invoice_no"?: string,"is_demo"?: boolean,"issue_date"?: string,"kind"?: string,"organization_id"?: string | null,"paid_at"?: string | null,"status"?: string,"total_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "invoices_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"meetings": {
                  Row: {
                    "attendee_ids": (string)[],"created_at": string,"created_by": string | null,"deal_id": string | null,"deleted_at": string | null,"ends_at": string | null,"id": string,"is_demo": boolean,"location": string | null,"notes": string | null,"organization_id": string | null,"starts_at": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "attendee_ids"?: (string)[],"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"ends_at"?: string | null,"id"?: string,"is_demo"?: boolean,"location"?: string | null,"notes"?: string | null,"organization_id"?: string | null,"starts_at": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "attendee_ids"?: (string)[],"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"ends_at"?: string | null,"id"?: string,"is_demo"?: boolean,"location"?: string | null,"notes"?: string | null,"organization_id"?: string | null,"starts_at"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetings_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": string,"is_demo": boolean,"kind": string,"read_at": string | null,"title": string,"user_id": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"is_demo"?: boolean,"kind": string,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: string,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "country": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description": string | null,"id": string,"is_demo": boolean,"last_contact_at": string | null,"linked_profile_id": string | null,"name": string,"regions_of_interest": (string)[],"relationship_owner_id": string | null,"search": unknown,"sectors": (Database["public"]['Enums']["sector"])[],"status": string,"ticket_currency": string | null,"ticket_max_minor": number | null,"ticket_min_minor": number | null,"type": Database["public"]['Enums']["org_type"],"updated_at": string,"website": string | null
                  }
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"last_contact_at"?: string | null,"linked_profile_id"?: string | null,"name": string,"regions_of_interest"?: (string)[],"relationship_owner_id"?: string | null,"search"?: never,"sectors"?: (Database["public"]['Enums']["sector"])[],"status"?: string,"ticket_currency"?: string | null,"ticket_max_minor"?: number | null,"ticket_min_minor"?: number | null,"type": Database["public"]['Enums']["org_type"],"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"last_contact_at"?: string | null,"linked_profile_id"?: string | null,"name"?: string,"regions_of_interest"?: (string)[],"relationship_owner_id"?: string | null,"search"?: never,"sectors"?: (Database["public"]['Enums']["sector"])[],"status"?: string,"ticket_currency"?: string | null,"ticket_max_minor"?: number | null,"ticket_min_minor"?: number | null,"type"?: Database["public"]['Enums']["org_type"],"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_country_fkey"
      columns: ["country"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "organizations_country_fkey"
      columns: ["country"]
isOneToOne: false
      referencedRelation: "v_deals_by_country"
      referencedColumns: ["country"]
    },{
      foreignKeyName: "organizations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_linked_profile_id_fkey"
      columns: ["linked_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_relationship_owner_id_fkey"
      columns: ["relationship_owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_ticket_currency_fkey"
      columns: ["ticket_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"pipeline_stages": {
                  Row: {
                    "default_probability": number,"is_advanced": boolean,"is_terminal": boolean,"is_won": boolean,"key": string,"label": string,"sort_order": number
                  }
                  Insert: {
                    "default_probability": number,"is_advanced"?: boolean,"is_terminal"?: boolean,"is_won"?: boolean,"key": string,"label": string,"sort_order": number
                  }
                  Update: {
                    "default_probability"?: number,"is_advanced"?: boolean,"is_terminal"?: boolean,"is_won"?: boolean,"key"?: string,"label"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["user_role"],"title": string | null,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deal_id": string | null,"deleted_at": string | null,"description": string | null,"id": string,"is_demo": boolean,"name": string,"owner_id": string | null,"start_date": string | null,"status": string,"target_date": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"owner_id"?: string | null,"start_date"?: string | null,"status"?: string,"target_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"owner_id"?: string | null,"start_date"?: string | null,"status"?: string,"target_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_views": {
                  Row: {
                    "config": NonNullable<Json>,"created_at": string,"id": string,"is_shared": boolean,"module": string,"name": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"is_shared"?: boolean,"module": string,"name": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"is_shared"?: boolean,"module"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_views_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"completed_at": string | null,"contract_id": string | null,"created_at": string,"created_by": string | null,"deal_id": string | null,"deleted_at": string | null,"description": string | null,"due_date": string | null,"id": string,"is_demo": boolean,"organization_id": string | null,"priority": Database["public"]['Enums']["priority"],"project_id": string | null,"recurrence_rule": string | null,"search": unknown,"source": string,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"contract_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"organization_id"?: string | null,"priority"?: Database["public"]['Enums']["priority"],"project_id"?: string | null,"recurrence_rule"?: string | null,"search"?: never,"source"?: string,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"contract_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"organization_id"?: string | null,"priority"?: Database["public"]['Enums']["priority"],"project_id"?: string | null,"recurrence_rule"?: string | null,"search"?: never,"source"?: string,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_contract_fk"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string | null,"amount_minor": number,"bank_account_id": string | null,"counterparty_org_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"deal_id": string | null,"deleted_at": string | null,"description": string,"id": string,"is_demo": boolean,"is_payroll": boolean,"is_transfer": boolean,"txn_date": string,"updated_at": string
                  }
                  Insert: {
                    "account_id"?: string | null,"amount_minor": number,"bank_account_id"?: string | null,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"deal_id"?: string | null,"deleted_at"?: string | null,"description": string,"id"?: string,"is_demo"?: boolean,"is_payroll"?: boolean,"is_transfer"?: boolean,"txn_date": string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"amount_minor"?: number,"bank_account_id"?: string | null,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string,"id"?: string,"is_demo"?: boolean,"is_payroll"?: boolean,"is_transfer"?: boolean,"txn_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_bank_account_id_fkey"
      columns: ["bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_counterparty_org_id_fkey"
      columns: ["counterparty_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "transactions_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_attention_queue": {
                  Row: {
                    "deal_id": string | null,"detail": string | null,"due_date": string | null,"entity_id": string | null,"entity_type": string | null,"is_demo": boolean | null,"kind": string | null,"severity": string | null,"title": string | null
                  }
                  Relationships: [
                    
                  ]
                },"v_deals_by_country": {
                  Row: {
                    "country": string | null,"country_name": string | null,"deal_count": number | null,"deals": Json | null,"region": string | null,"value_usd": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_pipeline_by_stage": {
                  Row: {
                    "deal_count": number | null,"is_terminal": boolean | null,"is_won": boolean | null,"key": string | null,"label": string | null,"missing_fx": number | null,"sort_order": number | null,"value_usd": number | null,"weighted_usd": number | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "command_center_kpis":
{ Args: { "p_from": string,"p_points"?: number,"p_to": string }; Returns: Json
                           },
"demo_data_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"log_event":
{ Args: { "p_action": string,"p_context"?: Json,"p_row_id": string,"p_table": string }; Returns: undefined
                           },
"reveal_bank_account_iban":
{ Args: { "p_id": string }; Returns: string
                           },
"search_everything":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "entity_id": string,"entity_type": string,"rank": number,"subtitle": string,"title": string
            }[]
                           },
"set_bank_account_iban":
{ Args: { "p_iban": string,"p_id": string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user": string }; Returns: undefined
                           },
"verify_introductions_chain":
{ Args: { "p_demo"?: boolean }; Returns: {
              "first_broken_seq": number,"head_hash": string,"ok": boolean,"rows_checked": number
            }[]
                           },
"wipe_demo_data":
{ Args: { "p_confirm": string }; Returns: Json
                           }
          }
          Enums: {
            "activity_scope": "principal"|"management"|"deal"|"internal","confidentiality": "public"|"internal"|"confidential"|"restricted","contract_status": "draft"|"negotiating"|"awaiting_signature"|"active"|"expired"|"terminated","contract_type": "ncnda"|"mandate_non_circumvention"|"lease"|"employment"|"supplier"|"spv"|"engagement"|"other","document_status": "draft"|"awaiting_signature"|"signed"|"final"|"superseded","org_type": "investor"|"project_owner"|"strategic_partner"|"introducer"|"government"|"supplier","priority": "low"|"medium"|"high"|"urgent","renewal_type": "fixed"|"auto_renew","sector": "agriculture"|"energy"|"real_estate"|"infrastructure"|"commodities"|"industry"|"education"|"telecoms","task_status": "todo"|"in_progress"|"blocked"|"done"|"cancelled","user_role": "principal"|"manager"|"staff"|"external"
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "activity_scope": ["principal", "management", "deal", "internal"],"confidentiality": ["public", "internal", "confidential", "restricted"],"contract_status": ["draft", "negotiating", "awaiting_signature", "active", "expired", "terminated"],"contract_type": ["ncnda", "mandate_non_circumvention", "lease", "employment", "supplier", "spv", "engagement", "other"],"document_status": ["draft", "awaiting_signature", "signed", "final", "superseded"],"org_type": ["investor", "project_owner", "strategic_partner", "introducer", "government", "supplier"],"priority": ["low", "medium", "high", "urgent"],"renewal_type": ["fixed", "auto_renew"],"sector": ["agriculture", "energy", "real_estate", "infrastructure", "commodities", "industry", "education", "telecoms"],"task_status": ["todo", "in_progress", "blocked", "done", "cancelled"],"user_role": ["principal", "manager", "staff", "external"]
          }
        }
} as const

