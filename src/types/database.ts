
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
            "event_members": {
                  Row: {
                    "added_at": string,"event_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"event_id": string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"event_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_members_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "nodes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_settings": {
                  Row: {
                    "completed_at": string | null,"ends_at": string | null,"event_id": string,"event_status": Database["public"]['Enums']["event_status"],"location": string | null,"review_mode": Database["public"]['Enums']["review_mode"],"starts_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"ends_at"?: string | null,"event_id": string,"event_status"?: Database["public"]['Enums']["event_status"],"location"?: string | null,"review_mode"?: Database["public"]['Enums']["review_mode"],"starts_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"ends_at"?: string | null,"event_id"?: string,"event_status"?: Database["public"]['Enums']["event_status"],"location"?: string | null,"review_mode"?: Database["public"]['Enums']["review_mode"],"starts_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_settings_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "nodes"
      referencedColumns: ["id"]
    }
                  ]
                },"node_updates": {
                  Row: {
                    "body": string | null,"created_at": string,"event_id": string,"from_status": Database["public"]['Enums']["task_status"] | null,"id": string,"kind": Database["public"]['Enums']["update_kind"],"link_url": string | null,"node_id": string,"to_status": Database["public"]['Enums']["task_status"] | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"event_id": string,"from_status"?: Database["public"]['Enums']["task_status"] | null,"id"?: string,"kind": Database["public"]['Enums']["update_kind"],"link_url"?: string | null,"node_id": string,"to_status"?: Database["public"]['Enums']["task_status"] | null,"user_id"?: string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"event_id"?: string,"from_status"?: Database["public"]['Enums']["task_status"] | null,"id"?: string,"kind"?: Database["public"]['Enums']["update_kind"],"link_url"?: string | null,"node_id"?: string,"to_status"?: Database["public"]['Enums']["task_status"] | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "node_updates_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "nodes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "node_updates_node_id_fkey"
      columns: ["node_id"]
isOneToOne: false
      referencedRelation: "nodes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "node_updates_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"nodes": {
                  Row: {
                    "assignee_id": string | null,"created_at": string,"created_by": string,"depth": number,"description": string | null,"due_at": string | null,"event_id": string,"id": string,"org_id": string,"parent_id": string | null,"path": unknown,"position": number,"priority": Database["public"]['Enums']["priority_level"],"progress_cached": number,"status": Database["public"]['Enums']["task_status"] | null,"submitted_at": string | null,"title": string,"type": Database["public"]['Enums']["node_type"],"updated_at": string,"verified_at": string | null,"verified_by": string | null,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"created_at"?: string,"created_by"?: string,"depth": number,"description"?: string | null,"due_at"?: string | null,"event_id": string,"id"?: string,"org_id": string,"parent_id"?: string | null,"path": unknown,"position"?: number,"priority"?: Database["public"]['Enums']["priority_level"],"progress_cached"?: number,"status"?: Database["public"]['Enums']["task_status"] | null,"submitted_at"?: string | null,"title": string,"type": Database["public"]['Enums']["node_type"],"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"weight"?: number
                  }
                  Update: {
                    "assignee_id"?: string | null,"created_at"?: string,"created_by"?: string,"depth"?: number,"description"?: string | null,"due_at"?: string | null,"event_id"?: string,"id"?: string,"org_id"?: string,"parent_id"?: string | null,"path"?: unknown,"position"?: number,"priority"?: Database["public"]['Enums']["priority_level"],"progress_cached"?: number,"status"?: Database["public"]['Enums']["task_status"] | null,"submitted_at"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["node_type"],"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "nodes_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nodes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nodes_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "nodes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nodes_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nodes_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "nodes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nodes_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_members": {
                  Row: {
                    "joined_at": string,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"org_id": string,"role"?: Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"join_code": string,"kind": Database["public"]['Enums']["org_kind"],"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"join_code"?: string,"kind"?: Database["public"]['Enums']["org_kind"],"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"join_code"?: string,"kind"?: Database["public"]['Enums']["org_kind"],"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"full_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_event":
{ Args: { "p_description": string,"p_ends_at": string,"p_location": string,"p_org": string,"p_review_mode": Database["public"]['Enums']["review_mode"],"p_starts_at": string,"p_title": string }; Returns: string
                           },
"create_node":
{ Args: { "p_assignee": string,"p_description": string,"p_due_at": string,"p_parent": string,"p_priority": Database["public"]['Enums']["priority_level"],"p_title": string,"p_type": Database["public"]['Enums']["node_type"],"p_weight": number }; Returns: {
              "assignee_id": string | null,
"created_at": string,
"created_by": string,
"depth": number,
"description": string | null,
"due_at": string | null,
"event_id": string,
"id": string,
"org_id": string,
"parent_id": string | null,
"path": unknown,
"position": number,
"priority": Database["public"]['Enums']["priority_level"],
"progress_cached": number,
"status": Database["public"]['Enums']["task_status"] | null,
"submitted_at": string | null,
"title": string,
"type": Database["public"]['Enums']["node_type"],
"updated_at": string,
"verified_at": string | null,
"verified_by": string | null,
"weight": number
            }
                          SetofOptions: {
        from: "*"
        to: "nodes"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_organization":
{ Args: { "p_kind": Database["public"]['Enums']["org_kind"],"p_name": string,"p_slug": string }; Returns: {
              "created_at": string,
"created_by": string,
"id": string,
"join_code": string,
"kind": Database["public"]['Enums']["org_kind"],
"name": string,
"slug": string
            }
                          SetofOptions: {
        from: "*"
        to: "organizations"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_event_tree":
{ Args: { "p_event": string }; Returns: {
              "assignee_avatar": string,"assignee_id": string,"assignee_name": string,"depth": number,"description": string,"due_at": string,"id": string,"parent_id": string,"position": number,"priority": Database["public"]['Enums']["priority_level"],"progress": number,"status": Database["public"]['Enums']["task_status"],"submitted_at": string,"title": string,"type": Database["public"]['Enums']["node_type"],"verified_at": string,"weight": number
            }[]
                           },
"get_my_tasks":
{ Args: Record<PropertyKey, never>; Returns: {
              "due_at": string,"event_id": string,"event_status": Database["public"]['Enums']["event_status"],"event_title": string,"node_id": string,"org_slug": string,"priority": Database["public"]['Enums']["priority_level"],"status": Database["public"]['Enums']["task_status"],"title": string
            }[]
                           },
"get_review_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "assignee_name": string,"event_id": string,"event_title": string,"node_id": string,"org_slug": string,"submitted_at": string,"title": string
            }[]
                           },
"join_org_by_code":
{ Args: { "p_code": string }; Returns: {
              "created_at": string,
"created_by": string,
"id": string,
"join_code": string,
"kind": Database["public"]['Enums']["org_kind"],
"name": string,
"slug": string
            }
                          SetofOptions: {
        from: "*"
        to: "organizations"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_org_member":
{ Args: { "p_org": string,"p_user": string }; Returns: undefined
                           },
"rotate_join_code":
{ Args: { "p_org": string }; Returns: string
                           },
"set_event_status":
{ Args: { "p_event": string,"p_to": Database["public"]['Enums']["event_status"] }; Returns: undefined
                           },
"set_org_member_role":
{ Args: { "p_org": string,"p_role": Database["public"]['Enums']["org_role"],"p_user": string }; Returns: undefined
                           },
"transition_task_status":
{ Args: { "p_comment"?: string,"p_from": Database["public"]['Enums']["task_status"],"p_node": string,"p_to": Database["public"]['Enums']["task_status"] }; Returns: {
              "assignee_id": string | null,
"created_at": string,
"created_by": string,
"depth": number,
"description": string | null,
"due_at": string | null,
"event_id": string,
"id": string,
"org_id": string,
"parent_id": string | null,
"path": unknown,
"position": number,
"priority": Database["public"]['Enums']["priority_level"],
"progress_cached": number,
"status": Database["public"]['Enums']["task_status"] | null,
"submitted_at": string | null,
"title": string,
"type": Database["public"]['Enums']["node_type"],
"updated_at": string,
"verified_at": string | null,
"verified_by": string | null,
"weight": number
            }
                          SetofOptions: {
        from: "*"
        to: "nodes"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "event_status": "draft"|"active"|"completed"|"archived","node_type": "event"|"segment"|"task","org_kind": "club"|"organization"|"university_program"|"other","org_role": "admin"|"member","priority_level": "low"|"medium"|"high"|"urgent","review_mode": "assignee_submits"|"head_only","task_status": "todo"|"in_progress"|"submitted"|"verified","update_kind": "comment"|"proof_link"|"status_change"
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
            "event_status": ["draft", "active", "completed", "archived"],"node_type": ["event", "segment", "task"],"org_kind": ["club", "organization", "university_program", "other"],"org_role": ["admin", "member"],"priority_level": ["low", "medium", "high", "urgent"],"review_mode": ["assignee_submits", "head_only"],"task_status": ["todo", "in_progress", "submitted", "verified"],"update_kind": ["comment", "proof_link", "status_change"]
          }
        }
} as const
