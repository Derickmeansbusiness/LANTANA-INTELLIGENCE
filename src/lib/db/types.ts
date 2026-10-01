
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
                },"agent_actions": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"error": string | null,"executed_at": string | null,"id": string,"payload": NonNullable<Json>,"preview": NonNullable<Json>,"result": Json | null,"status": string,"summary": string,"thread_id": string | null,"tool": string,"tool_use_id": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"error"?: string | null,"executed_at"?: string | null,"id"?: string,"payload": NonNullable<Json>,"preview"?: NonNullable<Json>,"result"?: Json | null,"status"?: string,"summary": string,"thread_id"?: string | null,"tool": string,"tool_use_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"error"?: string | null,"executed_at"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"preview"?: NonNullable<Json>,"result"?: Json | null,"status"?: string,"summary"?: string,"thread_id"?: string | null,"tool"?: string,"tool_use_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_actions_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "agent_threads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_actions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_messages": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"id": number,"model": string | null,"role": string,"thread_id": string
                  }
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"id"?: never,"model"?: string | null,"role": string,"thread_id": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"id"?: never,"model"?: string | null,"role"?: string,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "agent_threads"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_threads": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"entity_id": string | null,"entity_type": string | null,"id": string,"pinned": boolean,"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"pinned"?: boolean,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"pinned"?: boolean,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_threads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_usage": {
                  Row: {
                    "cache_read_tokens": number,"cache_write_tokens": number,"created_at": string,"id": number,"input_tokens": number,"kind": string,"model": string,"output_tokens": number,"thread_id": string | null,"user_id": string
                  }
                  Insert: {
                    "cache_read_tokens"?: number,"cache_write_tokens"?: number,"created_at"?: string,"id"?: never,"input_tokens"?: number,"kind": string,"model": string,"output_tokens"?: number,"thread_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "cache_read_tokens"?: number,"cache_write_tokens"?: number,"created_at"?: string,"id"?: never,"input_tokens"?: number,"kind"?: string,"model"?: string,"output_tokens"?: number,"thread_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_usage_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "agent_threads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts_sent": {
                  Row: {
                    "entity_id": string,"entity_type": string,"id": number,"kind": string,"sent_at": string,"target_date": string,"threshold_days": number
                  }
                  Insert: {
                    "entity_id": string,"entity_type": string,"id"?: never,"kind": string,"sent_at"?: string,"target_date": string,"threshold_days": number
                  }
                  Update: {
                    "entity_id"?: string,"entity_type"?: string,"id"?: never,"kind"?: string,"sent_at"?: string,"target_date"?: string,"threshold_days"?: number
                  }
                  Relationships: [
                    
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
                },"bills": {
                  Row: {
                    "account_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"deleted_at": string | null,"description": string,"document_id": string | null,"due_date": string,"id": string,"is_demo": boolean,"issue_date": string,"notes": string | null,"paid_at": string | null,"reference": string | null,"status": string,"supplier_name": string | null,"supplier_org_id": string | null,"total_minor": number,"updated_at": string
                  }
                  Insert: {
                    "account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"deleted_at"?: string | null,"description": string,"document_id"?: string | null,"due_date": string,"id"?: string,"is_demo"?: boolean,"issue_date": string,"notes"?: string | null,"paid_at"?: string | null,"reference"?: string | null,"status"?: string,"supplier_name"?: string | null,"supplier_org_id"?: string | null,"total_minor": number,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"description"?: string,"document_id"?: string | null,"due_date"?: string,"id"?: string,"is_demo"?: boolean,"issue_date"?: string,"notes"?: string | null,"paid_at"?: string | null,"reference"?: string | null,"status"?: string,"supplier_name"?: string | null,"supplier_org_id"?: string | null,"total_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bills_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bills_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bills_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "bills_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bills_supplier_org_id_fkey"
      columns: ["supplier_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"briefings": {
                  Row: {
                    "briefing_date": string,"content": string,"created_at": string,"facts": NonNullable<Json>,"id": string,"model": string | null,"user_id": string
                  }
                  Insert: {
                    "briefing_date"?: string,"content": string,"created_at"?: string,"facts"?: NonNullable<Json>,"id"?: string,"model"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "briefing_date"?: string,"content"?: string,"created_at"?: string,"facts"?: NonNullable<Json>,"id"?: string,"model"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "briefings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"budgets": {
                  Row: {
                    "account_id": string,"amount_minor": number,"created_at": string,"created_by": string | null,"currency": string,"deleted_at": string | null,"id": string,"is_demo": boolean,"month": string,"notes": string | null,"updated_at": string
                  }
                  Insert: {
                    "account_id": string,"amount_minor": number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"month": string,"notes"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"amount_minor"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"month"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budgets_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budgets_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"category_rules": {
                  Row: {
                    "account_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"is_demo": boolean,"pattern": string,"updated_at": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"pattern": string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"pattern"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "category_rules_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "category_rules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"checklist_items": {
                  Row: {
                    "checklist_id": string,"created_at": string,"created_by": string | null,"done_at": string | null,"done_by": string | null,"due_date": string | null,"id": string,"is_demo": boolean,"owner_id": string | null,"position": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "checklist_id": string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"owner_id"?: string | null,"position"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "checklist_id"?: string,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"owner_id"?: string | null,"position"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_items_checklist_id_fkey"
      columns: ["checklist_id"]
isOneToOne: false
      referencedRelation: "checklists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklist_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklist_items_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklist_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"checklists": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"employee_id": string,"id": string,"is_demo": boolean,"kind": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"employee_id": string,"id"?: string,"is_demo"?: boolean,"kind": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"employee_id"?: string,"id"?: string,"is_demo"?: boolean,"kind"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklists_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklists_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"clause_reviews": {
                  Row: {
                    "contract_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document_id": string | null,"findings": NonNullable<Json>,"id": string,"is_demo": boolean,"model": string | null,"summary": string,"template_id": string,"version_id": string | null
                  }
                  Insert: {
                    "contract_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"findings"?: NonNullable<Json>,"id"?: string,"is_demo"?: boolean,"model"?: string | null,"summary": string,"template_id": string,"version_id"?: string | null
                  }
                  Update: {
                    "contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"findings"?: NonNullable<Json>,"id"?: string,"is_demo"?: boolean,"model"?: string | null,"summary"?: string,"template_id"?: string,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clause_reviews_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clause_reviews_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clause_reviews_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clause_reviews_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "document_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"company": {
                  Row: {
                    "address_lines": (string)[],"base_currency": string,"created_at": string,"email": string | null,"id": boolean,"legal_name": string,"licence_no": string | null,"licensing_authority": string | null,"mohre_establishment_id": string | null,"phone": string | null,"require_principal_mfa": boolean,"timezone": string,"updated_at": string,"website": string | null,"wps_employer_bank_code": string | null
                  }
                  Insert: {
                    "address_lines"?: (string)[],"base_currency"?: string,"created_at"?: string,"email"?: string | null,"id"?: boolean,"legal_name": string,"licence_no"?: string | null,"licensing_authority"?: string | null,"mohre_establishment_id"?: string | null,"phone"?: string | null,"require_principal_mfa"?: boolean,"timezone"?: string,"updated_at"?: string,"website"?: string | null,"wps_employer_bank_code"?: string | null
                  }
                  Update: {
                    "address_lines"?: (string)[],"base_currency"?: string,"created_at"?: string,"email"?: string | null,"id"?: boolean,"legal_name"?: string,"licence_no"?: string | null,"licensing_authority"?: string | null,"mohre_establishment_id"?: string | null,"phone"?: string | null,"require_principal_mfa"?: boolean,"timezone"?: string,"updated_at"?: string,"website"?: string | null,"wps_employer_bank_code"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"compliance_items": {
                  Row: {
                    "authority": string | null,"category": string,"completed_on": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document_id": string | null,"due_date": string | null,"id": string,"is_demo": boolean,"next_item_id": string | null,"notes": string | null,"owner_id": string | null,"recurrence": string | null,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "authority"?: string | null,"category": string,"completed_on"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"next_item_id"?: string | null,"notes"?: string | null,"owner_id"?: string | null,"recurrence"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "authority"?: string | null,"category"?: string,"completed_on"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"next_item_id"?: string | null,"notes"?: string | null,"owner_id"?: string | null,"recurrence"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "compliance_items_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compliance_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compliance_items_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compliance_items_next_item_id_fkey"
      columns: ["next_item_id"]
isOneToOne: false
      referencedRelation: "compliance_items"
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
                    "contract_type": Database["public"]['Enums']["contract_type"],"counterparty_address_confirmed": boolean,"counterparty_org_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document_id": string | null,"effective_date": string | null,"end_date": string | null,"esign_status": string | null,"exclusivity": string | null,"fee_terms": string | null,"forum": string | null,"governing_law": string | null,"id": string,"is_demo": boolean,"notes": string | null,"notice_period_days": number | null,"owner_id": string | null,"renewal_type": Database["public"]['Enums']["renewal_type"],"signatory_confirmed": boolean,"signatory_name": string | null,"signing_authority_confirmed": boolean,"status": Database["public"]['Enums']["contract_status"],"term_months": number | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "contract_type": Database["public"]['Enums']["contract_type"],"counterparty_address_confirmed"?: boolean,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"effective_date"?: string | null,"end_date"?: string | null,"esign_status"?: string | null,"exclusivity"?: string | null,"fee_terms"?: string | null,"forum"?: string | null,"governing_law"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"notice_period_days"?: number | null,"owner_id"?: string | null,"renewal_type"?: Database["public"]['Enums']["renewal_type"],"signatory_confirmed"?: boolean,"signatory_name"?: string | null,"signing_authority_confirmed"?: boolean,"status"?: Database["public"]['Enums']["contract_status"],"term_months"?: number | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "contract_type"?: Database["public"]['Enums']["contract_type"],"counterparty_address_confirmed"?: boolean,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"effective_date"?: string | null,"end_date"?: string | null,"esign_status"?: string | null,"exclusivity"?: string | null,"fee_terms"?: string | null,"forum"?: string | null,"governing_law"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"notice_period_days"?: number | null,"owner_id"?: string | null,"renewal_type"?: Database["public"]['Enums']["renewal_type"],"signatory_confirmed"?: boolean,"signatory_name"?: string | null,"signing_authority_confirmed"?: boolean,"status"?: Database["public"]['Enums']["contract_status"],"term_months"?: number | null,"title"?: string,"updated_at"?: string
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
    },{
      foreignKeyName: "contracts_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"corporate_records": {
                  Row: {
                    "authority": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"detail": string | null,"document_id": string | null,"expiry_date": string | null,"holder": string | null,"id": string,"is_demo": boolean,"issue_date": string | null,"kind": string,"notes": string | null,"reference_no": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "authority"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"detail"?: string | null,"document_id"?: string | null,"expiry_date"?: string | null,"holder"?: string | null,"id"?: string,"is_demo"?: boolean,"issue_date"?: string | null,"kind": string,"notes"?: string | null,"reference_no"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "authority"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"detail"?: string | null,"document_id"?: string | null,"expiry_date"?: string | null,"holder"?: string | null,"id"?: string,"is_demo"?: boolean,"issue_date"?: string | null,"kind"?: string,"notes"?: string | null,"reference_no"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "corporate_records_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "corporate_records_document_id_fkey"
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
                },"data_room_documents": {
                  Row: {
                    "added_at": string,"added_by": string | null,"document_id": string,"is_demo": boolean,"position": number,"room_id": string
                  }
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"document_id": string,"is_demo"?: boolean,"position"?: number,"room_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"document_id"?: string,"is_demo"?: boolean,"position"?: number,"room_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_room_documents_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_room_documents_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_room_documents_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "data_rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"data_room_events": {
                  Row: {
                    "document_id": string | null,"id": number,"is_demo": boolean,"kind": string,"occurred_at": string,"profile_id": string | null,"room_id": string,"storage_path": string | null
                  }
                  Insert: {
                    "document_id"?: string | null,"id"?: never,"is_demo"?: boolean,"kind": string,"occurred_at"?: string,"profile_id"?: string | null,"room_id": string,"storage_path"?: string | null
                  }
                  Update: {
                    "document_id"?: string | null,"id"?: never,"is_demo"?: boolean,"kind"?: string,"occurred_at"?: string,"profile_id"?: string | null,"room_id"?: string,"storage_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_room_events_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_room_events_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_room_events_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "data_rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"data_room_members": {
                  Row: {
                    "company": string | null,"created_at": string,"email": string,"full_name": string | null,"id": string,"invited_by": string | null,"is_demo": boolean,"profile_id": string | null,"revoked_at": string | null,"room_id": string
                  }
                  Insert: {
                    "company"?: string | null,"created_at"?: string,"email": string,"full_name"?: string | null,"id"?: string,"invited_by"?: string | null,"is_demo"?: boolean,"profile_id"?: string | null,"revoked_at"?: string | null,"room_id": string
                  }
                  Update: {
                    "company"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"invited_by"?: string | null,"is_demo"?: boolean,"profile_id"?: string | null,"revoked_at"?: string | null,"room_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_room_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_room_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_room_members_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "data_rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"data_rooms": {
                  Row: {
                    "allow_download": boolean,"created_at": string,"created_by": string | null,"deal_id": string | null,"deleted_at": string | null,"description": string | null,"expires_on": string | null,"id": string,"is_demo": boolean,"name": string,"organization_id": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "allow_download"?: boolean,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"expires_on"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"organization_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "allow_download"?: boolean,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"expires_on"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"organization_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_rooms_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_rooms_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_rooms_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
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
                    "country": string | null,"created_at": string,"created_by": string | null,"currency": string,"deleted_at": string | null,"expected_close_date": string | null,"fee_pct": number | null,"fee_terms": string | null,"id": string,"introducer_org_id": string | null,"is_demo": boolean,"last_activity_at": string,"name": string,"next_step": string | null,"next_step_due": string | null,"owner_id": string | null,"probability": number | null,"project_owner_org_id": string | null,"search": unknown,"sector": Database["public"]['Enums']["sector"],"spv_planned": boolean,"stage": string,"summary": string | null,"ticket_minor": number | null,"updated_at": string
                  }
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"expected_close_date"?: string | null,"fee_pct"?: number | null,"fee_terms"?: string | null,"id"?: string,"introducer_org_id"?: string | null,"is_demo"?: boolean,"last_activity_at"?: string,"name": string,"next_step"?: string | null,"next_step_due"?: string | null,"owner_id"?: string | null,"probability"?: number | null,"project_owner_org_id"?: string | null,"search"?: never,"sector": Database["public"]['Enums']["sector"],"spv_planned"?: boolean,"stage"?: string,"summary"?: string | null,"ticket_minor"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"expected_close_date"?: string | null,"fee_pct"?: number | null,"fee_terms"?: string | null,"id"?: string,"introducer_org_id"?: string | null,"is_demo"?: boolean,"last_activity_at"?: string,"name"?: string,"next_step"?: string | null,"next_step_due"?: string | null,"owner_id"?: string | null,"probability"?: number | null,"project_owner_org_id"?: string | null,"search"?: never,"sector"?: Database["public"]['Enums']["sector"],"spv_planned"?: boolean,"stage"?: string,"summary"?: string | null,"ticket_minor"?: number | null,"updated_at"?: string
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
                },"document_chunks": {
                  Row: {
                    "content": string,"created_at": string,"document_id": string,"embedding": string | null,"id": number,"ordinal": number,"tsv": unknown,"version_id": string
                  }
                  Insert: {
                    "content": string,"created_at"?: string,"document_id": string,"embedding"?: string | null,"id"?: never,"ordinal": number,"tsv"?: never,"version_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"document_id"?: string,"embedding"?: string | null,"id"?: never,"ordinal"?: number,"tsv"?: never,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_chunks_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_chunks_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "document_versions"
      referencedColumns: ["id"]
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
                },"document_share_links": {
                  Row: {
                    "created_at": string,"created_by": string,"document_id": string,"expires_at": string,"id": string,"is_demo": boolean,"max_views": number | null,"recipient_email": string | null,"recipient_name": string,"revoked_at": string | null,"revoked_by": string | null,"token_hash": string,"version_id": string,"view_count": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"document_id": string,"expires_at": string,"id"?: string,"is_demo"?: boolean,"max_views"?: number | null,"recipient_email"?: string | null,"recipient_name": string,"revoked_at"?: string | null,"revoked_by"?: string | null,"token_hash": string,"version_id": string,"view_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"document_id"?: string,"expires_at"?: string,"id"?: string,"is_demo"?: boolean,"max_views"?: number | null,"recipient_email"?: string | null,"recipient_name"?: string,"revoked_at"?: string | null,"revoked_by"?: string | null,"token_hash"?: string,"version_id"?: string,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_share_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_share_links_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_share_links_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_share_links_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "document_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"document_share_views": {
                  Row: {
                    "id": number,"ip_hash": string | null,"link_id": string,"outcome": string,"user_agent": string | null,"viewed_at": string
                  }
                  Insert: {
                    "id"?: never,"ip_hash"?: string | null,"link_id": string,"outcome": string,"user_agent"?: string | null,"viewed_at"?: string
                  }
                  Update: {
                    "id"?: never,"ip_hash"?: string | null,"link_id"?: string,"outcome"?: string,"user_agent"?: string | null,"viewed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_share_views_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "document_share_links"
      referencedColumns: ["id"]
    }
                  ]
                },"document_tags": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_id": string,"tag_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_id": string,"tag_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_tags_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_tags_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"document_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_id": string,"embedded": boolean,"extraction_status": string,"file_name": string,"id": string,"is_demo": boolean,"mime_type": string | null,"note": string | null,"ocr_used": boolean,"page_count": number | null,"sha256": string | null,"size_bytes": number | null,"storage_path": string,"text_chars": number | null,"version_no": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_id": string,"embedded"?: boolean,"extraction_status"?: string,"file_name": string,"id"?: string,"is_demo"?: boolean,"mime_type"?: string | null,"note"?: string | null,"ocr_used"?: boolean,"page_count"?: number | null,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path": string,"text_chars"?: number | null,"version_no": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string,"embedded"?: boolean,"extraction_status"?: string,"file_name"?: string,"id"?: string,"is_demo"?: boolean,"mime_type"?: string | null,"note"?: string | null,"ocr_used"?: boolean,"page_count"?: number | null,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"text_chars"?: number | null,"version_no"?: number
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
                },"employee_compensation": {
                  Row: {
                    "basic_enc": string,"created_at": string,"created_by": string | null,"currency": string,"deleted_at": string | null,"effective_from": string,"employee_id": string,"housing_enc": string | null,"id": string,"is_demo": boolean,"note": string | null,"other_enc": string | null,"transport_enc": string | null,"updated_at": string
                  }
                  Insert: {
                    "basic_enc": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"effective_from": string,"employee_id": string,"housing_enc"?: string | null,"id"?: string,"is_demo"?: boolean,"note"?: string | null,"other_enc"?: string | null,"transport_enc"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "basic_enc"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"effective_from"?: string,"employee_id"?: string,"housing_enc"?: string | null,"id"?: string,"is_demo"?: boolean,"note"?: string | null,"other_enc"?: string | null,"transport_enc"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_compensation_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employee_compensation_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "employee_compensation_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"employee_identity": {
                  Row: {
                    "bank_name": string | null,"bank_routing_code": string | null,"created_at": string,"created_by": string | null,"date_of_birth": string | null,"emirates_id_last4": string | null,"emirates_id_no_enc": string | null,"employee_id": string,"iban_enc": string | null,"iban_last4": string | null,"is_demo": boolean,"labour_card_no_enc": string | null,"mohre_person_code_enc": string | null,"nationality": string | null,"passport_last4": string | null,"passport_no_enc": string | null,"updated_at": string,"visa_file_no_enc": string | null
                  }
                  Insert: {
                    "bank_name"?: string | null,"bank_routing_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_of_birth"?: string | null,"emirates_id_last4"?: string | null,"emirates_id_no_enc"?: string | null,"employee_id": string,"iban_enc"?: string | null,"iban_last4"?: string | null,"is_demo"?: boolean,"labour_card_no_enc"?: string | null,"mohre_person_code_enc"?: string | null,"nationality"?: string | null,"passport_last4"?: string | null,"passport_no_enc"?: string | null,"updated_at"?: string,"visa_file_no_enc"?: string | null
                  }
                  Update: {
                    "bank_name"?: string | null,"bank_routing_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_of_birth"?: string | null,"emirates_id_last4"?: string | null,"emirates_id_no_enc"?: string | null,"employee_id"?: string,"iban_enc"?: string | null,"iban_last4"?: string | null,"is_demo"?: boolean,"labour_card_no_enc"?: string | null,"mohre_person_code_enc"?: string | null,"nationality"?: string | null,"passport_last4"?: string | null,"passport_no_enc"?: string | null,"updated_at"?: string,"visa_file_no_enc"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_identity_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employee_identity_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: true
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"employees": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"department": string | null,"emirates_id_expiry": string | null,"employment_type": string,"end_date": string | null,"full_name": string,"id": string,"insurance_expiry": string | null,"is_demo": boolean,"job_title": string | null,"labour_card_expiry": string | null,"manager_id": string | null,"on_payroll": boolean,"passport_expiry": string | null,"phone": string | null,"probation_end": string | null,"profile_id": string | null,"start_date": string | null,"status": string,"updated_at": string,"visa_expiry": string | null,"work_email": string | null,"work_location": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"department"?: string | null,"emirates_id_expiry"?: string | null,"employment_type"?: string,"end_date"?: string | null,"full_name": string,"id"?: string,"insurance_expiry"?: string | null,"is_demo"?: boolean,"job_title"?: string | null,"labour_card_expiry"?: string | null,"manager_id"?: string | null,"on_payroll"?: boolean,"passport_expiry"?: string | null,"phone"?: string | null,"probation_end"?: string | null,"profile_id"?: string | null,"start_date"?: string | null,"status"?: string,"updated_at"?: string,"visa_expiry"?: string | null,"work_email"?: string | null,"work_location"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"department"?: string | null,"emirates_id_expiry"?: string | null,"employment_type"?: string,"end_date"?: string | null,"full_name"?: string,"id"?: string,"insurance_expiry"?: string | null,"is_demo"?: boolean,"job_title"?: string | null,"labour_card_expiry"?: string | null,"manager_id"?: string | null,"on_payroll"?: boolean,"passport_expiry"?: string | null,"phone"?: string | null,"probation_end"?: string | null,"profile_id"?: string | null,"start_date"?: string | null,"status"?: string,"updated_at"?: string,"visa_expiry"?: string | null,"work_email"?: string | null,"work_location"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employees_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employees_manager_id_fkey"
      columns: ["manager_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employees_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
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
                },"interactions": {
                  Row: {
                    "contact_id": string | null,"created_at": string,"created_by": string | null,"deal_id": string | null,"deleted_at": string | null,"id": string,"is_demo": boolean,"kind": string,"occurred_on": string,"organization_id": string | null,"summary": string,"updated_at": string
                  }
                  Insert: {
                    "contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"kind": string,"occurred_on": string,"organization_id"?: string | null,"summary": string,"updated_at"?: string
                  }
                  Update: {
                    "contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: string,"occurred_on"?: string,"organization_id"?: string | null,"summary"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interactions_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interactions_deal_id_fkey"
      columns: ["deal_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interactions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
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
                },"invoice_items": {
                  Row: {
                    "amount_minor": number,"created_at": string,"created_by": string | null,"description": string,"id": string,"invoice_id": string,"is_demo": boolean,"position": number,"quantity": number,"unit_price_minor": number,"updated_at": string
                  }
                  Insert: {
                    "amount_minor"?: number,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"invoice_id": string,"is_demo"?: boolean,"position"?: number,"quantity"?: number,"unit_price_minor": number,"updated_at"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"invoice_id"?: string,"is_demo"?: boolean,"position"?: number,"quantity"?: number,"unit_price_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"deal_id": string | null,"deleted_at": string | null,"due_date": string,"id": string,"invoice_no": string,"is_demo": boolean,"issue_date": string,"kind": string,"notes": string | null,"organization_id": string | null,"paid_at": string | null,"reference": string | null,"status": string,"subtotal_minor": number | null,"total_minor": number,"updated_at": string,"vat_minor": number,"vat_rate": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"deal_id"?: string | null,"deleted_at"?: string | null,"due_date": string,"id"?: string,"invoice_no": string,"is_demo"?: boolean,"issue_date": string,"kind"?: string,"notes"?: string | null,"organization_id"?: string | null,"paid_at"?: string | null,"reference"?: string | null,"status"?: string,"subtotal_minor"?: number | null,"total_minor": number,"updated_at"?: string,"vat_minor"?: number,"vat_rate"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"deal_id"?: string | null,"deleted_at"?: string | null,"due_date"?: string,"id"?: string,"invoice_no"?: string,"is_demo"?: boolean,"issue_date"?: string,"kind"?: string,"notes"?: string | null,"organization_id"?: string | null,"paid_at"?: string | null,"reference"?: string | null,"status"?: string,"subtotal_minor"?: number | null,"total_minor"?: number,"updated_at"?: string,"vat_minor"?: number,"vat_rate"?: number
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
                },"leave_balances": {
                  Row: {
                    "carried_over": number,"created_at": string,"created_by": string | null,"employee_id": string,"entitled_days": number,"id": string,"is_demo": boolean,"kind": string,"notes": string | null,"updated_at": string,"year": number
                  }
                  Insert: {
                    "carried_over"?: number,"created_at"?: string,"created_by"?: string | null,"employee_id": string,"entitled_days": number,"id"?: string,"is_demo"?: boolean,"kind": string,"notes"?: string | null,"updated_at"?: string,"year": number
                  }
                  Update: {
                    "carried_over"?: number,"created_at"?: string,"created_by"?: string | null,"employee_id"?: string,"entitled_days"?: number,"id"?: string,"is_demo"?: boolean,"kind"?: string,"notes"?: string | null,"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "leave_balances_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leave_balances_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"leave_requests": {
                  Row: {
                    "created_at": string,"created_by": string | null,"days": number,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"deleted_at": string | null,"employee_id": string,"end_date": string,"id": string,"is_demo": boolean,"kind": string,"reason": string | null,"start_date": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"days": number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"deleted_at"?: string | null,"employee_id": string,"end_date": string,"id"?: string,"is_demo"?: boolean,"kind": string,"reason"?: string | null,"start_date": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"days"?: number,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"deleted_at"?: string | null,"employee_id"?: string,"end_date"?: string,"id"?: string,"is_demo"?: boolean,"kind"?: string,"reason"?: string | null,"start_date"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leave_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leave_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leave_requests_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
                  ]
                },"meetings": {
                  Row: {
                    "attendee_ids": (string)[],"created_at": string,"created_by": string | null,"deal_id": string | null,"deleted_at": string | null,"ends_at": string | null,"id": string,"is_demo": boolean,"kind": string,"location": string | null,"minutes": string | null,"minutes_approved_at": string | null,"minutes_document_id": string | null,"notes": string | null,"organization_id": string | null,"starts_at": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "attendee_ids"?: (string)[],"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"ends_at"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: string,"location"?: string | null,"minutes"?: string | null,"minutes_approved_at"?: string | null,"minutes_document_id"?: string | null,"notes"?: string | null,"organization_id"?: string | null,"starts_at": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "attendee_ids"?: (string)[],"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"ends_at"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: string,"location"?: string | null,"minutes"?: string | null,"minutes_approved_at"?: string | null,"minutes_document_id"?: string | null,"notes"?: string | null,"organization_id"?: string | null,"starts_at"?: string,"title"?: string,"updated_at"?: string
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
      foreignKeyName: "meetings_minutes_document_id_fkey"
      columns: ["minutes_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"due_date": string | null,"id": string,"is_demo": boolean,"name": string,"project_id": string,"sort_order": number,"status": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"project_id": string,"sort_order"?: number,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"project_id"?: string,"sort_order"?: number,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string,"deleted_at": string | null,"entity_id": string,"entity_type": string,"id": string,"is_demo": boolean,"pinned": boolean,"updated_at": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"entity_id": string,"entity_type": string,"id"?: string,"is_demo"?: boolean,"pinned"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"entity_id"?: string,"entity_type"?: string,"id"?: string,"is_demo"?: boolean,"pinned"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"payroll_items": {
                  Row: {
                    "allowances_enc": string | null,"basic_enc": string,"created_at": string,"created_by": string | null,"days_in_period": number,"days_paid": number,"deductions_enc": string | null,"employee_id": string,"id": string,"is_demo": boolean,"note": string | null,"run_id": string,"updated_at": string,"variable_enc": string | null
                  }
                  Insert: {
                    "allowances_enc"?: string | null,"basic_enc": string,"created_at"?: string,"created_by"?: string | null,"days_in_period": number,"days_paid": number,"deductions_enc"?: string | null,"employee_id": string,"id"?: string,"is_demo"?: boolean,"note"?: string | null,"run_id": string,"updated_at"?: string,"variable_enc"?: string | null
                  }
                  Update: {
                    "allowances_enc"?: string | null,"basic_enc"?: string,"created_at"?: string,"created_by"?: string | null,"days_in_period"?: number,"days_paid"?: number,"deductions_enc"?: string | null,"employee_id"?: string,"id"?: string,"is_demo"?: boolean,"note"?: string | null,"run_id"?: string,"updated_at"?: string,"variable_enc"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payroll_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_items_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_items_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "payroll_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"payroll_runs": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"created_by": string | null,"currency": string,"deleted_at": string | null,"id": string,"is_demo": boolean,"notes": string | null,"paid_at": string | null,"pay_date": string | null,"period": string,"status": string,"transaction_id": string | null,"updated_at": string,"wps_note": string | null,"wps_reference": string | null,"wps_status": string
                  }
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"paid_at"?: string | null,"pay_date"?: string | null,"period": string,"status"?: string,"transaction_id"?: string | null,"updated_at"?: string,"wps_note"?: string | null,"wps_reference"?: string | null,"wps_status"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"notes"?: string | null,"paid_at"?: string | null,"pay_date"?: string | null,"period"?: string,"status"?: string,"transaction_id"?: string | null,"updated_at"?: string,"wps_note"?: string | null,"wps_reference"?: string | null,"wps_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payroll_runs_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_runs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payroll_runs_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "payroll_runs_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
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
                },"report_runs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_id": string | null,"id": string,"is_demo": boolean,"name": string,"pack": string | null,"period_from": string,"period_to": string,"report_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"pack"?: string | null,"period_from": string,"period_to": string,"report_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"pack"?: string | null,"period_from"?: string,"period_to"?: string,"report_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_runs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_runs_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_runs_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"report_schedules": {
                  Row: {
                    "active": boolean,"cadence": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"is_demo": boolean,"last_notified_on": string | null,"pack": string | null,"recipient_ids": (string)[],"report_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"cadence": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"last_notified_on"?: string | null,"pack"?: string | null,"recipient_ids"?: (string)[],"report_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"cadence"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"last_notified_on"?: string | null,"pack"?: string | null,"recipient_ids"?: (string)[],"report_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_schedules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_schedules_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"is_demo": boolean,"name": string,"period": string,"sections": (string)[],"shared": boolean,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"period"?: string,"sections": (string)[],"shared"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"period"?: string,"sections"?: (string)[],"shared"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"resolutions": {
                  Row: {
                    "body": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"document_id": string | null,"id": string,"is_demo": boolean,"kind": string,"meeting_id": string | null,"passed_on": string | null,"ref_no": string | null,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: string,"meeting_id"?: string | null,"passed_on"?: string | null,"ref_no"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"document_id"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: string,"meeting_id"?: string | null,"passed_on"?: string | null,"ref_no"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resolutions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resolutions_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resolutions_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
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
                },"tags": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_demo": boolean,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tags_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_checklist_items": {
                  Row: {
                    "created_at": string,"created_by": string | null,"done": boolean,"id": string,"is_demo": boolean,"label": string,"sort_order": number,"task_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"done"?: boolean,"id"?: string,"is_demo"?: boolean,"label": string,"sort_order"?: number,"task_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"done"?: boolean,"id"?: string,"is_demo"?: boolean,"label"?: string,"sort_order"?: number,"task_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_checklist_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_checklist_items_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_comments": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string,"deleted_at": string | null,"id": string,"is_demo": boolean,"task_id": string,"updated_at": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"task_id": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"id"?: string,"is_demo"?: boolean,"task_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_comments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_comments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_dependencies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"depends_on_id": string,"is_demo": boolean,"task_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_id": string,"is_demo"?: boolean,"task_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_id"?: string,"is_demo"?: boolean,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_dependencies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_depends_on_id_fkey"
      columns: ["depends_on_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"completed_at": string | null,"contract_id": string | null,"created_at": string,"created_by": string | null,"deal_id": string | null,"deleted_at": string | null,"description": string | null,"due_date": string | null,"id": string,"is_demo": boolean,"milestone_id": string | null,"organization_id": string | null,"priority": Database["public"]['Enums']["priority"],"project_id": string | null,"recurrence_parent_id": string | null,"recurrence_rule": string | null,"search": unknown,"source": string,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"contract_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"milestone_id"?: string | null,"organization_id"?: string | null,"priority"?: Database["public"]['Enums']["priority"],"project_id"?: string | null,"recurrence_parent_id"?: string | null,"recurrence_rule"?: string | null,"search"?: never,"source"?: string,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"contract_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"milestone_id"?: string | null,"organization_id"?: string | null,"priority"?: Database["public"]['Enums']["priority"],"project_id"?: string | null,"recurrence_parent_id"?: string | null,"recurrence_rule"?: string | null,"search"?: never,"source"?: string,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
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
      foreignKeyName: "tasks_milestone_id_fkey"
      columns: ["milestone_id"]
isOneToOne: false
      referencedRelation: "milestones"
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
    },{
      foreignKeyName: "tasks_recurrence_parent_id_fkey"
      columns: ["recurrence_parent_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"transaction_imports": {
                  Row: {
                    "bank_account_id": string | null,"created_at": string,"created_by": string | null,"file_name": string,"id": string,"imported_count": number,"is_demo": boolean,"row_count": number,"skipped_count": number
                  }
                  Insert: {
                    "bank_account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"file_name": string,"id"?: string,"imported_count"?: number,"is_demo"?: boolean,"row_count"?: number,"skipped_count"?: number
                  }
                  Update: {
                    "bank_account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"file_name"?: string,"id"?: string,"imported_count"?: number,"is_demo"?: boolean,"row_count"?: number,"skipped_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "transaction_imports_bank_account_id_fkey"
      columns: ["bank_account_id"]
isOneToOne: false
      referencedRelation: "bank_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transaction_imports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string | null,"amount_minor": number,"bank_account_id": string | null,"bill_id": string | null,"category_source": string,"counterparty_org_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"deal_id": string | null,"deleted_at": string | null,"description": string,"id": string,"import_hash": string | null,"import_id": string | null,"invoice_id": string | null,"is_demo": boolean,"is_payroll": boolean,"is_transfer": boolean,"notes": string | null,"reference": string | null,"txn_date": string,"updated_at": string
                  }
                  Insert: {
                    "account_id"?: string | null,"amount_minor": number,"bank_account_id"?: string | null,"bill_id"?: string | null,"category_source"?: string,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"deal_id"?: string | null,"deleted_at"?: string | null,"description": string,"id"?: string,"import_hash"?: string | null,"import_id"?: string | null,"invoice_id"?: string | null,"is_demo"?: boolean,"is_payroll"?: boolean,"is_transfer"?: boolean,"notes"?: string | null,"reference"?: string | null,"txn_date": string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"amount_minor"?: number,"bank_account_id"?: string | null,"bill_id"?: string | null,"category_source"?: string,"counterparty_org_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deal_id"?: string | null,"deleted_at"?: string | null,"description"?: string,"id"?: string,"import_hash"?: string | null,"import_id"?: string | null,"invoice_id"?: string | null,"is_demo"?: boolean,"is_payroll"?: boolean,"is_transfer"?: boolean,"notes"?: string | null,"reference"?: string | null,"txn_date"?: string,"updated_at"?: string
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
      foreignKeyName: "transactions_bill_id_fkey"
      columns: ["bill_id"]
isOneToOne: false
      referencedRelation: "bills"
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
    },{
      foreignKeyName: "transactions_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "transaction_imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"user_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_profile_id": string | null,"created_at": string,"email": string,"expires_at": string,"full_name": string | null,"id": string,"invited_by": string | null,"is_demo": boolean,"note": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["user_role"],"title": string | null
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_profile_id"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"full_name"?: string | null,"id"?: string,"invited_by"?: string | null,"is_demo"?: boolean,"note"?: string | null,"revoked_at"?: string | null,"role": Database["public"]['Enums']["user_role"],"title"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_profile_id"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"full_name"?: string | null,"id"?: string,"invited_by"?: string | null,"is_demo"?: boolean,"note"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_invites_accepted_profile_id_fkey"
      columns: ["accepted_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "agent_usage_month": {
                  Row: {
                    "cache_read_tokens": number | null,"cache_write_tokens": number | null,"calls": number | null,"full_name": string | null,"input_tokens": number | null,"kind": string | null,"output_tokens": number | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"v_attention_queue": {
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
                },"v_leave_balances": {
                  Row: {
                    "carried_over": number | null,"employee_id": string | null,"entitled_days": number | null,"kind": string | null,"pending_days": number | null,"remaining_days": number | null,"taken_days": number | null,"year": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "leave_balances_employee_id_fkey"
      columns: ["employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id"]
    }
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
            "add_employee_compensation":
{ Args: { "p_basic_minor": number,"p_currency": string,"p_effective_from": string,"p_employee": string,"p_housing_minor"?: number,"p_note"?: string,"p_other_minor"?: number,"p_transport_minor"?: number }; Returns: string
                           },
"command_center_kpis":
{ Args: { "p_from": string,"p_points"?: number,"p_to": string }; Returns: Json
                           },
"create_payroll_run":
{ Args: { "p_pay_date"?: string,"p_period": string }; Returns: Json
                           },
"demo_data_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"employee_compensation_history":
{ Args: { "p_employee": string }; Returns: {
              "basic_minor": number,"created_at": string,"currency": string,"effective_from": string,"housing_minor": number,"id": string,"note": string,"other_minor": number,"total_minor": number,"transport_minor": number
            }[]
                           },
"finance_cash_monthly":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "closing_aed": number,"inflow_aed": number,"month": string,"outflow_aed": number
            }[]
                           },
"finance_monthly":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "account_id": string,"amount_aed": number,"code": string,"missing_fx": number,"month": string,"name": string,"type": string
            }[]
                           },
"log_event":
{ Args: { "p_action": string,"p_context"?: Json,"p_row_id": string,"p_table": string }; Returns: undefined
                           },
"log_export":
{ Args: { "p_scope": string,"p_tables": (string)[] }; Returns: undefined
                           },
"log_room_open":
{ Args: { "p_room": string }; Returns: undefined
                           },
"match_investors":
{ Args: { "p_deal": string,"p_limit"?: number }; Returns: {
              "already_involved": boolean,"country": string,"geo_points": number,"name": string,"organization_id": string,"reasons": (string)[],"score": number,"sector_points": number,"ticket_points": number
            }[]
                           },
"move_deal_stage":
{ Args: { "p_deal": string,"p_note"?: string,"p_stage": string }; Returns: undefined
                           },
"open_room_document":
{ Args: { "p_document": string,"p_download"?: boolean,"p_room": string }; Returns: {
              "allow_download": boolean,"file_name": string,"mime_type": string,"room_name": string,"storage_path": string,"title": string,"viewer_email": string
            }[]
                           },
"open_share_link":
{ Args: { "p_ip_hash"?: string,"p_token": string,"p_user_agent"?: string }; Returns: {
              "document_title": string,"expires_at": string,"file_name": string,"link_id": string,"mime_type": string,"ok": boolean,"reason": string,"recipient_name": string,"storage_path": string,"views_left": number
            }[]
                           },
"payroll_run_detail":
{ Args: { "p_run": string }; Returns: {
              "allowances_minor": number,"basic_minor": number,"days_in_period": number,"days_paid": number,"deductions_minor": number,"employee_id": string,"full_name": string,"item_id": string,"net_minor": number,"note": string,"variable_minor": number
            }[]
                           },
"payroll_wps_data":
{ Args: { "p_run": string }; Returns: Json
                           },
"people_directory":
{ Args: Record<PropertyKey, never>; Returns: {
              "department": string,"full_name": string,"id": string,"is_self": boolean,"job_title": string,"manager_name": string,"phone": string,"status": string,"work_email": string
            }[]
                           },
"portal_room_documents":
{ Args: { "p_room": string }; Returns: {
              "doc_type": string,"document_id": string,"mime_type": string,"size_bytes": number,"sort_order": number,"title": string,"updated_at": string,"version_no": number
            }[]
                           },
"reveal_bank_account_iban":
{ Args: { "p_id": string }; Returns: string
                           },
"reveal_employee_identity":
{ Args: { "p_employee": string }; Returns: Json
                           },
"run_expiry_alerts_now":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"run_nightly_scan_now":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"salary_certificate_data":
{ Args: { "p_employee": string }; Returns: Json
                           },
"search_documents":
{ Args: { "p_embedding"?: string,"p_limit"?: number,"p_query": string }; Returns: {
              "doc_type": string,"document_id": string,"matched": string,"score": number,"snippet": string,"status": string,"title": string
            }[]
                           },
"search_everything":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "entity_id": string,"entity_type": string,"rank": number,"subtitle": string,"title": string
            }[]
                           },
"set_bank_account_iban":
{ Args: { "p_iban": string,"p_id": string }; Returns: undefined
                           },
"set_employee_identity":
{ Args: { "p_employee": string,"p_values": Json }; Returns: undefined
                           },
"set_payroll_status":
{ Args: { "p_account"?: string,"p_bank_account"?: string,"p_paid_on"?: string,"p_run": string,"p_status": string }; Returns: undefined
                           },
"set_payroll_wps":
{ Args: { "p_note"?: string,"p_reference"?: string,"p_run": string,"p_status": string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user": string }; Returns: undefined
                           },
"suggest_transaction_categories":
{ Args: { "p_descriptions": (string)[] }; Returns: {
              "account_id": string,"ord": number,"reason": string,"source": string
            }[]
                           },
"update_payroll_item":
{ Args: { "p_deductions_minor": number,"p_item": string,"p_note": string,"p_variable_minor": number }; Returns: undefined
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

