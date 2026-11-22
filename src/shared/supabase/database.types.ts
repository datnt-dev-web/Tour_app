
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
            "ai_cache": {
                  Row: {
                    "expires_at": string,"key": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"key": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "expires_at"?: string,"key"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"place_photos": {
                  Row: {
                    "created_at": string,"file_format": string | null,"file_public_id": string,"id": string,"place_id": string,"trip_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_format"?: string | null,"file_public_id": string,"id"?: string,"place_id": string,"trip_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"file_format"?: string | null,"file_public_id"?: string,"id"?: string,"place_id"?: string,"trip_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"place_reviews_internal": {
                  Row: {
                    "rating": number | null,"created_at": string,"id": string,"note": string | null,"place_id": string,"trip_id": string | null,"user_id": string,"verdict": string
                  }
                  ComputedFields: never
                  Insert: {
                    "rating"?: number | null,"created_at"?: string,"id"?: string,"note"?: string | null,"place_id": string,"trip_id"?: string | null,"user_id"?: string,"verdict": string
                  }
                  Update: {
                    "rating"?: number | null,"created_at"?: string,"id"?: string,"note"?: string | null,"place_id"?: string,"trip_id"?: string | null,"user_id"?: string,"verdict"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "place_reviews_internal_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "place_reviews_internal_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "place_reviews_internal_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"places": {
                  Row: {
                    "address": string | null,"category": Database["public"]['Enums']["place_category"],"city": string,"city_norm": string,"created_by": string | null,"google_place_id": string | null,"group_id": string,"id": string,"maps_url": string | null,"name": string,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"category": Database["public"]['Enums']["place_category"],"city": string,"city_norm": string,"created_by"?: string | null,"google_place_id"?: string | null,"group_id": string,"id"?: string,"maps_url"?: string | null,"name": string,"verified"?: boolean
                  }
                  Update: {
                    "address"?: string | null,"category"?: Database["public"]['Enums']["place_category"],"city"?: string,"city_norm"?: string,"created_by"?: string | null,"google_place_id"?: string | null,"group_id"?: string,"id"?: string,"maps_url"?: string | null,"name"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "places_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "places_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_color": string,"display_name": string,"id": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_color"?: string,"display_name": string,"id": string,"username"?: string | null
                  }
                  Update: {
                    "avatar_color"?: string,"display_name"?: string,"id"?: string,"username"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_reminders_sent": {
                  Row: {
                    "sent_at": string,"trip_place_id": string,"visit_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "sent_at"?: string,"trip_place_id": string,"visit_at": string
                  }
                  Update: {
                    "sent_at"?: string,"trip_place_id"?: string,"visit_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_reminders_sent_trip_place_id_fkey"
      columns: ["trip_place_id"]
isOneToOne: false
      referencedRelation: "trip_places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_reminders_sent_trip_place_id_fkey"
      columns: ["trip_place_id"]
isOneToOne: false
      referencedRelation: "trip_stops"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_tracks": {
                  Row: {
                    "artist": string | null,"created_at": string,"created_by": string | null,"duration_sec": number | null,"file_format": string | null,"file_public_id": string | null,"folder_id": string | null,"group_id": string,"id": string,"kind": Database["public"]['Enums']["track_kind"],"title": string,"youtube_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artist"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_sec"?: number | null,"file_format"?: string | null,"file_public_id"?: string | null,"folder_id"?: string | null,"group_id": string,"id"?: string,"kind": Database["public"]['Enums']["track_kind"],"title": string,"youtube_id"?: string | null
                  }
                  Update: {
                    "artist"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_sec"?: number | null,"file_format"?: string | null,"file_public_id"?: string | null,"folder_id"?: string | null,"group_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["track_kind"],"title"?: string,"youtube_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_tracks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_tracks_folder_fk"
      columns: ["folder_id","group_id"]
isOneToOne: false
      referencedRelation: "music_folders"
      referencedColumns: ["id","group_id"]
    },{
      foreignKeyName: "group_tracks_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_photos": {
                  Row: {
                    "created_at": string,"file_format": string | null,"file_public_id": string,"height": number | null,"id": string,"trip_id": string,"user_id": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_format"?: string | null,"file_public_id": string,"height"?: number | null,"id"?: string,"trip_id": string,"user_id"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"file_format"?: string | null,"file_public_id"?: string,"height"?: number | null,"id"?: string,"trip_id"?: string,"user_id"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_photos_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"music_folders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"group_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"group_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"group_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "music_folders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "music_folders_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_expenses": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"id": string,"label": string,"paid_by": string | null,"trip_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"label": string,"paid_by"?: string | null,"trip_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"label"?: string,"paid_by"?: string | null,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_expenses_paid_by_fkey"
      columns: ["trip_id","paid_by"]
isOneToOne: false
      referencedRelation: "trip_participants"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "trip_expenses_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_infos": {
                  Row: {
                    "body": string | null,"created_at": string,"created_by": string | null,"file_bytes": number | null,"file_format": string | null,"file_name": string | null,"file_public_id": string | null,"file_resource_type": string | null,"id": string,"kind": Database["public"]['Enums']["trip_info_kind"],"title": string,"trip_id": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"created_by"?: string | null,"file_bytes"?: number | null,"file_format"?: string | null,"file_name"?: string | null,"file_public_id"?: string | null,"file_resource_type"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["trip_info_kind"],"title": string,"trip_id": string,"url"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"created_by"?: string | null,"file_bytes"?: number | null,"file_format"?: string | null,"file_name"?: string | null,"file_public_id"?: string | null,"file_resource_type"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["trip_info_kind"],"title"?: string,"trip_id"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_infos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_infos_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_participants": {
                  Row: {
                    "account_name": string | null,"account_no": string | null,"bank_bin": string | null,"created_at": string,"id": string,"name": string,"trip_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name"?: string | null,"account_no"?: string | null,"bank_bin"?: string | null,"created_at"?: string,"id"?: string,"name": string,"trip_id": string
                  }
                  Update: {
                    "account_name"?: string | null,"account_no"?: string | null,"bank_bin"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_participants_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_places": {
                  Row: {
                    "added_by": string | null,"cost": number | null,"id": string,"note": string | null,"paid_by": string | null,"place_id": string,"status": Database["public"]['Enums']["trip_place_status"],"transport": string | null,"trip_id": string,"visit_date": string | null,"visit_end_time": string | null,"visit_time": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"cost"?: number | null,"id"?: string,"note"?: string | null,"paid_by"?: string | null,"place_id": string,"status"?: Database["public"]['Enums']["trip_place_status"],"transport"?: string | null,"trip_id": string,"visit_date"?: string | null,"visit_end_time"?: string | null,"visit_time"?: string | null
                  }
                  Update: {
                    "added_by"?: string | null,"cost"?: number | null,"id"?: string,"note"?: string | null,"paid_by"?: string | null,"place_id"?: string,"status"?: Database["public"]['Enums']["trip_place_status"],"transport"?: string | null,"trip_id"?: string,"visit_date"?: string | null,"visit_end_time"?: string | null,"visit_time"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_places_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_places_paid_by_fkey"
      columns: ["trip_id","paid_by"]
isOneToOne: false
      referencedRelation: "trip_participants"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "trip_places_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_places_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_transfers": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"from_id": string,"id": string,"to_id": string,"trip_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"from_id": string,"id"?: string,"to_id": string,"trip_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"from_id"?: string,"id"?: string,"to_id"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_transfers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_transfers_from_fkey"
      columns: ["trip_id","from_id"]
isOneToOne: false
      referencedRelation: "trip_participants"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "trip_transfers_to_fkey"
      columns: ["trip_id","to_id"]
isOneToOne: false
      referencedRelation: "trip_participants"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "trip_transfers_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "city": string,"created_by": string | null,"end_date": string | null,"group_id": string,"id": string,"name": string,"party_size": number,"share_expires_at": string | null,"share_token": string | null,"start_date": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"created_by"?: string | null,"end_date"?: string | null,"group_id": string,"id"?: string,"name": string,"party_size"?: number,"share_expires_at"?: string | null,"share_token"?: string | null,"start_date"?: string | null
                  }
                  Update: {
                    "city"?: string,"created_by"?: string | null,"end_date"?: string | null,"group_id"?: string,"id"?: string,"name"?: string,"party_size"?: number,"share_expires_at"?: string | null,"share_token"?: string | null,"start_date"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trips_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trips_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "trip_stops": {
                  Row: {
                    "added_by": string | null,"category": Database["public"]['Enums']["place_category"],"clash": boolean,"cost": number | null,"id": string,"note": string | null,"paid_by": string | null,"place_id": string,"status": Database["public"]['Enums']["trip_place_status"],"transport": string | null,"trip_id": string,"visit_date": string | null,"visit_end_time": string | null,"visit_time": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "trip_places_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_places_paid_by_fkey"
      columns: ["trip_id","paid_by"]
isOneToOne: false
      referencedRelation: "trip_participants"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "trip_places_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_places_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "due_push_reminders":
{ Args: { "p_window_min": number }; Returns: {
              "group_id": string,"place_name": string,"trip_id": string,"trip_name": string,"trip_place_id": string,"visit_at": string
            }[]
                           },
            "import_trip_places":
{ Args: { "p_trip_id": string,"p_rows": Json }; Returns: Json
                           },
            "is_group_member":
{ Args: { "gid": string }; Returns: boolean
                           },
            "trip_stats":
{ Args: { "p_trip_id": string }; Returns: Json
                           }
          }
          Enums: {
            "place_category": "food"|"snack"|"cafe"|"play"|"stay"|"gift","track_kind": "file"|"youtube","trip_info_kind": "note"|"link"|"file","trip_place_status": "wanted"|"confirmed"|"visited"|"dropped"
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
            "place_category": ["food", "snack", "cafe", "play", "stay", "gift"],"trip_info_kind": ["note", "link", "file"],"trip_place_status": ["wanted", "confirmed", "visited", "dropped"]
          }
        }
} as const
