export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string | null
          changes: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_user_actions: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          category_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string
          featured: boolean
          id: string
          image_url: string | null
          location: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          view_count: number
          website: string | null
        }
        Insert: {
          category_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description: string
          featured?: boolean
          id?: string
          image_url?: string | null
          location?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          view_count?: number
          website?: string | null
        }
        Update: {
          category_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          image_url?: string | null
          location?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertisements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          request_count: number | null
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          request_count?: number | null
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          request_count?: number | null
          user_id?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      business_messages: {
        Row: {
          contact_request_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          message_type: string
          recipient_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          contact_request_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          message_type?: string
          recipient_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          contact_request_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          message_type?: string
          recipient_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_invites: {
        Row: {
          accepted_at: string | null
          call_type: string
          callee_id: string | null
          caller_id: string
          conversation_id: string
          created_at: string
          ended_at: string | null
          ended_reason: string | null
          expires_at: string | null
          from_user_id: string
          id: string
          room_url: string | null
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          call_type: string
          callee_id?: string | null
          caller_id: string
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string | null
          from_user_id: string
          id?: string
          room_url?: string | null
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          call_type?: string
          callee_id?: string | null
          caller_id?: string
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string | null
          from_user_id?: string
          id?: string
          room_url?: string | null
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_session_id: string
          id: string
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_session_id: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_session_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_type: string
          conversation_id: string | null
          created_at: string | null
          daily_room_name: string
          daily_room_url: string
          ended_at: string | null
          expires_at: string
          group_id: string | null
          id: string
          initiated_by: string
          max_participants: number | null
          room_name: string | null
          room_url: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          call_type: string
          conversation_id?: string | null
          created_at?: string | null
          daily_room_name: string
          daily_room_url: string
          ended_at?: string | null
          expires_at: string
          group_id?: string | null
          id?: string
          initiated_by: string
          max_participants?: number | null
          room_name?: string | null
          room_url?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          call_type?: string
          conversation_id?: string | null
          created_at?: string | null
          daily_room_name?: string
          daily_room_url?: string
          ended_at?: string | null
          expires_at?: string
          group_id?: string | null
          id?: string
          initiated_by?: string
          max_participants?: number | null
          room_name?: string | null
          room_url?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at: string
          id: string
          room_url: string
          status: string
          updated_at: string
        }
        Insert: {
          call_type?: string
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at?: string
          id?: string
          room_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          room_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      chat_group_members: {
        Row: {
          created_at: string
          group_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_group_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          group_type: Database["public"]["Enums"]["group_type"]
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      class_attendance: {
        Row: {
          checked_in_at: string | null
          class_date: string
          class_time: string
          created_at: string | null
          group_id: string
          id: string
          marked_by: string | null
          notes: string | null
          scheduled_message_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          class_date: string
          class_time: string
          created_at?: string | null
          group_id: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          scheduled_message_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          class_date?: string
          class_time?: string
          created_at?: string | null
          group_id?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          scheduled_message_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_products: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      community_guidelines_acceptance: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      contact_access_logs: {
        Row: {
          access_type: string
          advertisement_id: string
          contact_request_id: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          advertisement_id: string
          contact_request_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          advertisement_id?: string
          contact_request_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_info_access_log: {
        Row: {
          access_type: string
          advertisement_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          advertisement_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          advertisement_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_info_access_log_advertisement_id_fkey"
            columns: ["advertisement_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          access_count: number | null
          access_expires_at: string | null
          access_granted_at: string | null
          advertisement_id: string
          business_notified_at: string | null
          contact_accessed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_request_at: string | null
          message: string
          request_count: number | null
          requester_email: string
          requester_id: string
          requester_name: string
          requires_verification: boolean | null
          risk_score: number | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
          verification_code: string | null
          verification_expires_at: string | null
          verification_token: string | null
        }
        Insert: {
          access_count?: number | null
          access_expires_at?: string | null
          access_granted_at?: string | null
          advertisement_id: string
          business_notified_at?: string | null
          contact_accessed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_request_at?: string | null
          message: string
          request_count?: number | null
          requester_email: string
          requester_id: string
          requester_name: string
          requires_verification?: boolean | null
          risk_score?: number | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
          verification_code?: string | null
          verification_expires_at?: string | null
          verification_token?: string | null
        }
        Update: {
          access_count?: number | null
          access_expires_at?: string | null
          access_granted_at?: string | null
          advertisement_id?: string
          business_notified_at?: string | null
          contact_accessed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_request_at?: string | null
          message?: string
          request_count?: number | null
          requester_email?: string
          requester_id?: string
          requester_name?: string
          requires_verification?: boolean | null
          risk_score?: number | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
          verification_code?: string | null
          verification_expires_at?: string | null
          verification_token?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          updated_at: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          check_in_time: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          rsvp_date: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          check_in_time?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          rsvp_date?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          check_in_time?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          rsvp_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waitlist: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          notified_at: string | null
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          notified_at?: string | null
          position: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          notified_at?: string | null
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attendees_count: number
          category: string
          created_at: string
          creator_id: string
          description: string
          end_at: string | null
          event_date: string
          event_time: string
          id: string
          image_url: string | null
          location: string
          max_attendees: number | null
          organizer_id: string
          start_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendees_count?: number
          category?: string
          created_at?: string
          creator_id: string
          description: string
          end_at?: string | null
          event_date: string
          event_time: string
          id?: string
          image_url?: string | null
          location: string
          max_attendees?: number | null
          organizer_id: string
          start_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendees_count?: number
          category?: string
          created_at?: string
          creator_id?: string
          description?: string
          end_at?: string | null
          event_date?: string
          event_time?: string
          id?: string
          image_url?: string | null
          location?: string
          max_attendees?: number | null
          organizer_id?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      flagged_keywords: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          keyword: string
          redirect_to_education: boolean
          severity: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          keyword: string
          redirect_to_education?: boolean
          severity: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          keyword?: string
          redirect_to_education?: boolean
          severity?: number
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
          updated_at: string
          user_high: string | null
          user_low: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
          user_high?: string | null
          user_low?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
          user_high?: string | null
          user_low?: string | null
        }
        Relationships: []
      }
      group_files: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          download_count: number | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          group_id: string
          id: string
          mime_type: string | null
          tags: string[] | null
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          group_id: string
          id?: string
          mime_type?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          download_count?: number | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          group_id?: string
          id?: string
          mime_type?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_files_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          role: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_poll_votes: {
        Row: {
          id: string
          option_ids: string[] | null
          poll_id: string
          user_id: string
          voted_at: string | null
        }
        Insert: {
          id?: string
          option_ids?: string[] | null
          poll_id: string
          user_id: string
          voted_at?: string | null
        }
        Update: {
          id?: string
          option_ids?: string[] | null
          poll_id?: string
          user_id?: string
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "group_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      group_polls: {
        Row: {
          allows_multiple_votes: boolean | null
          closes_at: string | null
          created_at: string | null
          created_by: string
          group_id: string
          id: string
          is_anonymous: boolean | null
          message_id: string | null
          options: Json
          poll_type: string | null
          question: string
          updated_at: string | null
        }
        Insert: {
          allows_multiple_votes?: boolean | null
          closes_at?: string | null
          created_at?: string | null
          created_by: string
          group_id: string
          id?: string
          is_anonymous?: boolean | null
          message_id?: string | null
          options: Json
          poll_type?: string | null
          question: string
          updated_at?: string | null
        }
        Update: {
          allows_multiple_votes?: boolean | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string
          group_id?: string
          id?: string
          is_anonymous?: boolean | null
          message_id?: string | null
          options?: Json
          poll_type?: string | null
          question?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      islamic_holidays: {
        Row: {
          created_at: string
          description: string | null
          hijri_day: number
          hijri_month: number
          id: string
          is_major_holiday: boolean
          name: string
          name_arabic: string | null
          significance: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          hijri_day: number
          hijri_month: number
          id?: string
          is_major_holiday?: boolean
          name: string
          name_arabic?: string | null
          significance?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          hijri_day?: number
          hijri_month?: number
          id?: string
          is_major_holiday?: boolean
          name?: string
          name_arabic?: string | null
          significance?: string | null
        }
        Relationships: []
      }
      jumuah_poll_responses: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          response: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          response: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          response?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      leadership_application_audit_logs: {
        Row: {
          action_type: string
          application_id: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          application_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          application_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leadership_applications: {
        Row: {
          availability: string
          created_at: string
          email: string
          experience: string
          full_name: string
          id: string
          location: string
          motivation: string
          phone_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability: string
          created_at?: string
          email: string
          experience: string
          full_name: string
          id?: string
          location: string
          motivation: string
          phone_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string
          created_at?: string
          email?: string
          experience?: string
          full_name?: string
          id?: string
          location?: string
          motivation?: string
          phone_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_lessons: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          level: string | null
          published: boolean | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          level?: string | null
          published?: boolean | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          level?: string | null
          published?: boolean | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          compression_ratio: number | null
          created_at: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string
          metadata: Json | null
          mime_type: string | null
          original_file_size: number | null
          thumbnail_url: string | null
          uploaded_by: string
        }
        Insert: {
          compression_ratio?: number | null
          created_at?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          message_id: string
          metadata?: Json | null
          mime_type?: string | null
          original_file_size?: number | null
          thumbnail_url?: string | null
          uploaded_by: string
        }
        Update: {
          compression_ratio?: number | null
          created_at?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
          metadata?: Json | null
          mime_type?: string | null
          original_file_size?: number | null
          thumbnail_url?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          forwarded_from: string | null
          group_id: string | null
          id: string
          inserted_at: string
          is_deleted: boolean
          is_pinned: boolean | null
          location: string | null
          message_type: string
          metadata: Json | null
          reactions: Json | null
          read_by: Json | null
          recipient_id: string | null
          reply_to: string | null
          sender_id: string
          status: string | null
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          forwarded_from?: string | null
          group_id?: string | null
          id?: string
          inserted_at?: string
          is_deleted?: boolean
          is_pinned?: boolean | null
          location?: string | null
          message_type?: string
          metadata?: Json | null
          reactions?: Json | null
          read_by?: Json | null
          recipient_id?: string | null
          reply_to?: string | null
          sender_id: string
          status?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          forwarded_from?: string | null
          group_id?: string | null
          id?: string
          inserted_at?: string
          is_deleted?: boolean
          is_pinned?: boolean | null
          location?: string | null
          message_type?: string
          metadata?: Json | null
          reactions?: Json | null
          read_by?: Json | null
          recipient_id?: string | null
          reply_to?: string | null
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_forwarded_from_fkey"
            columns: ["forwarded_from"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_profiles_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["moderation_action"]
          content_id: string | null
          content_snapshot: Json | null
          content_type: string | null
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string | null
          moderator_id: string
          notes: string | null
          reason: string
          report_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["moderation_action"]
          content_id?: string | null
          content_snapshot?: Json | null
          content_type?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          moderator_id: string
          notes?: string | null
          reason: string
          report_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["moderation_action"]
          content_id?: string | null
          content_snapshot?: Json | null
          content_type?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          moderator_id?: string
          notes?: string | null
          reason?: string
          report_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mosque_followers: {
        Row: {
          auto_join_groups: boolean | null
          followed_at: string | null
          id: string
          mosque_id: string
          notifications_enabled: boolean | null
          user_id: string
        }
        Insert: {
          auto_join_groups?: boolean | null
          followed_at?: string | null
          id?: string
          mosque_id: string
          notifications_enabled?: boolean | null
          user_id: string
        }
        Update: {
          auto_join_groups?: boolean | null
          followed_at?: string | null
          id?: string
          mosque_id?: string
          notifications_enabled?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mosque_followers_mosque_id_fkey"
            columns: ["mosque_id"]
            isOneToOne: false
            referencedRelation: "mosques"
            referencedColumns: ["id"]
          },
        ]
      }
      mosque_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          is_verified: boolean | null
          mosque_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          is_verified?: boolean | null
          mosque_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          is_verified?: boolean | null
          mosque_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mosque_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mosque_groups_mosque_id_fkey"
            columns: ["mosque_id"]
            isOneToOne: false
            referencedRelation: "mosques"
            referencedColumns: ["id"]
          },
        ]
      }
      mosque_reviews: {
        Row: {
          accessibility_rating: number | null
          cleanliness_rating: number | null
          created_at: string | null
          facilities_rating: number | null
          flag_reason: string | null
          friendliness_rating: number | null
          helpful_count: number | null
          id: string
          is_flagged: boolean | null
          is_verified_visit: boolean | null
          mosque_id: string
          not_helpful_count: number | null
          parking_rating: number | null
          rating: number
          review_text: string
          title: string
          updated_at: string | null
          user_id: string
          visit_date: string | null
        }
        Insert: {
          accessibility_rating?: number | null
          cleanliness_rating?: number | null
          created_at?: string | null
          facilities_rating?: number | null
          flag_reason?: string | null
          friendliness_rating?: number | null
          helpful_count?: number | null
          id?: string
          is_flagged?: boolean | null
          is_verified_visit?: boolean | null
          mosque_id: string
          not_helpful_count?: number | null
          parking_rating?: number | null
          rating: number
          review_text: string
          title: string
          updated_at?: string | null
          user_id: string
          visit_date?: string | null
        }
        Update: {
          accessibility_rating?: number | null
          cleanliness_rating?: number | null
          created_at?: string | null
          facilities_rating?: number | null
          flag_reason?: string | null
          friendliness_rating?: number | null
          helpful_count?: number | null
          id?: string
          is_flagged?: boolean | null
          is_verified_visit?: boolean | null
          mosque_id?: string
          not_helpful_count?: number | null
          parking_rating?: number | null
          rating?: number
          review_text?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mosque_reviews_mosque_id_fkey"
            columns: ["mosque_id"]
            isOneToOne: false
            referencedRelation: "mosques"
            referencedColumns: ["id"]
          },
        ]
      }
      mosque_submissions: {
        Row: {
          address: string
          city: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          image_url: string | null
          imam_name: string | null
          languages: string[] | null
          mosque_name: string
          phone: string | null
          prayer_times: Json | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          services: string[] | null
          state: string
          status: string
          updated_at: string
          user_id: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          imam_name?: string | null
          languages?: string[] | null
          mosque_name: string
          phone?: string | null
          prayer_times?: Json | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          services?: string[] | null
          state: string
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          imam_name?: string | null
          languages?: string[] | null
          mosque_name?: string
          phone?: string | null
          prayer_times?: Json | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          services?: string[] | null
          state?: string
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      mosques: {
        Row: {
          address: string
          city: string
          claimed_by: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          image_url: string | null
          imam_name: string | null
          languages: string[] | null
          name: string
          phone: string | null
          prayer_times: Json | null
          rating_average: number | null
          review_count: number | null
          services: string[] | null
          state: string
          updated_at: string | null
          verified: boolean | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address: string
          city: string
          claimed_by?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          imam_name?: string | null
          languages?: string[] | null
          name: string
          phone?: string | null
          prayer_times?: Json | null
          rating_average?: number | null
          review_count?: number | null
          services?: string[] | null
          state: string
          updated_at?: string | null
          verified?: boolean | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          city?: string
          claimed_by?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          imam_name?: string | null
          languages?: string[] | null
          name?: string
          phone?: string | null
          prayer_times?: Json | null
          rating_average?: number | null
          review_count?: number | null
          services?: string[] | null
          state?: string
          updated_at?: string | null
          verified?: boolean | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          body: string
          bundle_id: string | null
          created_at: string | null
          id: string
          is_bundled: boolean | null
          is_sent: boolean | null
          metadata: Json | null
          notification_type: string
          priority: number | null
          scheduled_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          bundle_id?: string | null
          created_at?: string | null
          id?: string
          is_bundled?: boolean | null
          is_sent?: boolean | null
          metadata?: Json | null
          notification_type: string
          priority?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          bundle_id?: string | null
          created_at?: string | null
          id?: string
          is_bundled?: boolean | null
          is_sent?: boolean | null
          metadata?: Json | null
          notification_type?: string
          priority?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      partnership_inquiries: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          inquiry_type: string
          message: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          inquiry_type?: string
          message: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          inquiry_type?: string
          message?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      partnership_inquiry_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string
          submission_count: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address: string
          submission_count?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string
          submission_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      prayer_completions: {
        Row: {
          completed_at: string | null
          id: string
          location: string | null
          on_time: boolean | null
          prayer_date: string
          prayer_name: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          location?: string | null
          on_time?: boolean | null
          prayer_date: string
          prayer_name: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          location?: string | null
          on_time?: boolean | null
          prayer_date?: string
          prayer_name?: string
          user_id?: string
        }
        Relationships: []
      }
      prayer_notification_preferences: {
        Row: {
          athan_audio_id: string | null
          athan_enabled: boolean | null
          created_at: string | null
          id: string
          jummah_reminder_day: string | null
          jummah_reminder_time: string | null
          notification_timing: number | null
          notifications_enabled: boolean | null
          notify_asr: boolean | null
          notify_dhuhr: boolean | null
          notify_fajr: boolean | null
          notify_isha: boolean | null
          notify_jummah: boolean | null
          notify_maghrib: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          athan_audio_id?: string | null
          athan_enabled?: boolean | null
          created_at?: string | null
          id?: string
          jummah_reminder_day?: string | null
          jummah_reminder_time?: string | null
          notification_timing?: number | null
          notifications_enabled?: boolean | null
          notify_asr?: boolean | null
          notify_dhuhr?: boolean | null
          notify_fajr?: boolean | null
          notify_isha?: boolean | null
          notify_jummah?: boolean | null
          notify_maghrib?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          athan_audio_id?: string | null
          athan_enabled?: boolean | null
          created_at?: string | null
          id?: string
          jummah_reminder_day?: string | null
          jummah_reminder_time?: string | null
          notification_timing?: number | null
          notifications_enabled?: boolean | null
          notify_asr?: boolean | null
          notify_dhuhr?: boolean | null
          notify_fajr?: boolean | null
          notify_isha?: boolean | null
          notify_jummah?: boolean | null
          notify_maghrib?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prayer_time_updates: {
        Row: {
          applied: boolean | null
          contact_email: string
          contact_name: string
          created_at: string
          id: string
          mosque_name: string
          notes: string | null
          prayer_times: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied?: boolean | null
          contact_email: string
          contact_name: string
          created_at?: string
          id?: string
          mosque_name: string
          notes?: string | null
          prayer_times: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied?: boolean | null
          contact_email?: string
          contact_name?: string
          created_at?: string
          id?: string
          mosque_name?: string
          notes?: string | null
          prayer_times?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          cj_product_id: string | null
          contact_url: string | null
          cost_price: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          image_url: string | null
          images: Json | null
          is_active: boolean | null
          last_synced_at: string | null
          name: string
          price: number | null
          raw: Json | null
          title: string | null
          variants: Json | null
        }
        Insert: {
          category?: string | null
          cj_product_id?: string | null
          contact_url?: string | null
          cost_price?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          last_synced_at?: string | null
          name: string
          price?: number | null
          raw?: Json | null
          title?: string | null
          variants?: Json | null
        }
        Update: {
          category?: string | null
          cj_product_id?: string | null
          contact_url?: string | null
          cost_price?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          last_synced_at?: string | null
          name?: string
          price?: number | null
          raw?: Json | null
          title?: string | null
          variants?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          phone_number: string | null
          show_online_status: boolean
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          location?: string | null
          phone_number?: string | null
          show_online_status?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone_number?: string | null
          show_online_status?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          device_info: Json | null
          endpoint: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          device_info?: Json | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_info?: Json | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          description: string
          id: string
          is_auto_flagged: boolean
          report_type: Database["public"]["Enums"]["report_type"]
          reported_by: string | null
          reported_user_id: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity_score: number | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          description: string
          id?: string
          is_auto_flagged?: boolean
          report_type: Database["public"]["Enums"]["report_type"]
          reported_by?: string | null
          reported_user_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity_score?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          description?: string
          id?: string
          is_auto_flagged?: boolean
          report_type?: Database["public"]["Enums"]["report_type"]
          reported_by?: string | null
          reported_user_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity_score?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: []
      }
      review_helpfulness: {
        Row: {
          created_at: string | null
          id: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_helpful?: boolean
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpfulness_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "mosque_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          photo_url: string
          review_id: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_url: string
          review_id: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_url?: string
          review_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "mosque_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_responses: {
        Row: {
          created_at: string | null
          id: string
          mosque_id: string
          responder_id: string
          response_text: string
          review_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mosque_id: string
          responder_id: string
          response_text: string
          review_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mosque_id?: string
          responder_id?: string
          response_text?: string
          review_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_mosque_id_fkey"
            columns: ["mosque_id"]
            isOneToOne: false
            referencedRelation: "mosques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "mosque_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          end_date: string | null
          group_id: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          message_type: string | null
          metadata: Json | null
          next_send_at: string | null
          schedule_days: number[] | null
          schedule_time: string
          schedule_type: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          end_date?: string | null
          group_id: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          message_type?: string | null
          metadata?: Json | null
          next_send_at?: string | null
          schedule_days?: number[] | null
          schedule_time: string
          schedule_type: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          end_date?: string | null
          group_id?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          message_type?: string | null
          metadata?: Json | null
          next_send_at?: string | null
          schedule_days?: number[] | null
          schedule_time?: string
          schedule_type?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      security_logs: {
        Row: {
          details: Json | null
          id: string
          table_name: string
          timestamp: string
          user_id: string | null
          violation_type: string
        }
        Insert: {
          details?: Json | null
          id?: string
          table_name: string
          timestamp?: string
          user_id?: string | null
          violation_type: string
        }
        Update: {
          details?: Json | null
          id?: string
          table_name?: string
          timestamp?: string
          user_id?: string | null
          violation_type?: string
        }
        Relationships: []
      }
      typing_activity_log: {
        Row: {
          ended_at: string | null
          id: string
          room_id: string
          started_at: string | null
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          room_id: string
          started_at?: string | null
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          room_id?: string
          started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_connections: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          requester_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          requester_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          requester_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          email: string
          feedback_type: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          feedback_type?: string
          id?: string
          message: string
          name: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          feedback_type?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string | null
          dm_notifications: boolean | null
          dm_sound_enabled: boolean | null
          dnd_days: number[] | null
          dnd_during_prayer: boolean | null
          dnd_enabled: boolean | null
          dnd_end_time: string | null
          dnd_start_time: string | null
          enable_summary_notifications: boolean | null
          event_notifications: boolean | null
          event_sound_enabled: boolean | null
          group_mentions_only: boolean | null
          group_notifications: boolean | null
          group_sound_enabled: boolean | null
          id: string
          max_notifications_per_hour: number | null
          notifications_enabled: boolean | null
          prayer_notifications: boolean | null
          prayer_sound_enabled: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          summary_delay_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dm_notifications?: boolean | null
          dm_sound_enabled?: boolean | null
          dnd_days?: number[] | null
          dnd_during_prayer?: boolean | null
          dnd_enabled?: boolean | null
          dnd_end_time?: string | null
          dnd_start_time?: string | null
          enable_summary_notifications?: boolean | null
          event_notifications?: boolean | null
          event_sound_enabled?: boolean | null
          group_mentions_only?: boolean | null
          group_notifications?: boolean | null
          group_sound_enabled?: boolean | null
          id?: string
          max_notifications_per_hour?: number | null
          notifications_enabled?: boolean | null
          prayer_notifications?: boolean | null
          prayer_sound_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          summary_delay_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dm_notifications?: boolean | null
          dm_sound_enabled?: boolean | null
          dnd_days?: number[] | null
          dnd_during_prayer?: boolean | null
          dnd_enabled?: boolean | null
          dnd_end_time?: string | null
          dnd_start_time?: string | null
          enable_summary_notifications?: boolean | null
          event_notifications?: boolean | null
          event_sound_enabled?: boolean | null
          group_mentions_only?: boolean | null
          group_notifications?: boolean | null
          group_sound_enabled?: boolean | null
          id?: string
          max_notifications_per_hour?: number | null
          notifications_enabled?: boolean | null
          prayer_notifications?: boolean | null
          prayer_sound_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          summary_delay_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          hide_status: boolean
          last_seen: string
          platform: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          hide_status?: boolean
          last_seen?: string
          platform?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          hide_status?: boolean
          last_seen?: string
          platform?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reputation: {
        Row: {
          approved_requests: number
          created_at: string
          id: string
          last_updated: string
          rejected_requests: number
          reputation_score: number
          spam_reports: number
          total_requests: number
          user_id: string
        }
        Insert: {
          approved_requests?: number
          created_at?: string
          id?: string
          last_updated?: string
          rejected_requests?: number
          reputation_score?: number
          spam_reports?: number
          total_requests?: number
          user_id: string
        }
        Update: {
          approved_requests?: number
          created_at?: string
          id?: string
          last_updated?: string
          rejected_requests?: number
          reputation_score?: number
          spam_reports?: number
          total_requests?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          last_activity: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_activity?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_activity?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_suspensions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          is_permanent: boolean
          moderation_log_id: string | null
          reason: string
          suspended_at: string
          suspended_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          moderation_log_id?: string | null
          reason: string
          suspended_at?: string
          suspended_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          moderation_log_id?: string | null
          reason?: string
          suspended_at?: string
          suspended_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_suspensions_moderation_log_id_fkey"
            columns: ["moderation_log_id"]
            isOneToOne: false
            referencedRelation: "moderation_logs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dm_conversations: {
        Row: {
          last_message: string | null
          last_message_at: string | null
          other_avatar_url: string | null
          other_full_name: string | null
          other_user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      audit_sensitive_access: {
        Args: { _action_type: string; _record_id: string; _table_name: string }
        Returns: undefined
      }
      calculate_risk_score: {
        Args: { _advertisement_id: string; _user_id: string }
        Returns: number
      }
      can_view_contact_fields: {
        Args: { _advertisement_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_contact_info: {
        Args: { _advertisement_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { _profile_user_id: string; _user_id: string }
        Returns: boolean
      }
      check_contact_access_rate_limit: {
        Args: { _advertisement_id: string; _user_id: string }
        Returns: boolean
      }
      check_content_for_flags: {
        Args: { content: string }
        Returns: {
          category: string
          matched_keyword: string
          severity: number
        }[]
      }
      cleanup_expired_contact_access: { Args: never; Returns: undefined }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      cleanup_old_contact_requests: { Args: never; Returns: undefined }
      decline_friend_request: {
        Args: { friendship_id: string }
        Returns: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
          updated_at: string
          user_high: string | null
          user_low: string | null
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_ad_contact_requests_secure: {
        Args: { _advertisement_id: string }
        Returns: {
          access_expires_at: string
          access_granted_at: string
          advertisement_id: string
          can_view_full_info: boolean
          created_at: string
          id: string
          message: string
          requester_email: string
          requester_name: string
          requires_verification: boolean
          risk_score: number
          status: string
        }[]
      }
      get_advertisement_contact_info: {
        Args: { _advertisement_id: string }
        Returns: {
          contact_email: string
          contact_phone: string
          id: string
        }[]
      }
      get_advertisement_contact_secure: {
        Args: { _advertisement_id: string }
        Returns: {
          access_granted: boolean
          contact_email: string
          contact_phone: string
          id: string
          requires_verification: boolean
        }[]
      }
      get_advertisement_owner_id: {
        Args: { _advertisement_id: string }
        Returns: string
      }
      get_all_public_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          location: string
          user_id: string
        }[]
      }
      get_connected_user_ids: { Args: { _user_id: string }; Returns: string[] }
      get_contact_requests_for_ad: {
        Args: { ad_id: string }
        Returns: {
          advertisement_id: string
          created_at: string
          id: string
          message: string
          requester_email: string
          requester_name: string
          status: string
          status_changed_at: string
        }[]
      }
      get_contact_requests_with_privacy: {
        Args: never
        Returns: {
          access_expires_at: string
          access_granted_at: string
          advertisement_id: string
          created_at: string
          id: string
          message: string
          requester_email: string
          requester_id: string
          requester_name: string
          requires_verification: boolean
          risk_score: number
          status: string
          status_changed_at: string
        }[]
      }
      get_leadership_applications_secure: {
        Args: never
        Returns: {
          availability: string
          created_at: string
          email: string
          experience: string
          full_name: string
          id: string
          location: string
          motivation: string
          phone_number: string
          status: string
          updated_at: string
        }[]
      }
      get_public_advertisements: {
        Args: never
        Returns: {
          category_id: string
          created_at: string
          description: string
          featured: boolean
          id: string
          image_url: string
          location: string
          status: string
          title: string
          updated_at: string
          view_count: number
          website: string
        }[]
      }
      get_public_profile: {
        Args: { _user_id: string }
        Returns: {
          full_name: string
          location: string
          user_id: string
        }[]
      }
      get_user_contact_requests_secure: {
        Args: never
        Returns: {
          access_expires_at: string
          access_granted_at: string
          advertisement_id: string
          created_at: string
          id: string
          message: string
          requester_email: string
          requester_name: string
          requires_verification: boolean
          risk_score: number
          status: string
          status_changed_at: string
          updated_at: string
        }[]
      }
      get_user_reputation: { Args: { _user_id: string }; Returns: number }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      grant_contact_access: {
        Args: { _contact_request_id: string; _hours?: number }
        Returns: boolean
      }
      has_accepted_connection: {
        Args: { _user1: string; _user2: string }
        Returns: boolean
      }
      has_accepted_guidelines: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_sensitive_field: { Args: { _input: string }; Returns: string }
      is_ad_owner: {
        Args: { _advertisement_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_group_admin: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_chat_group_creator: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_chat_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_creator: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member:
        | { Args: { _group_id: string; _user_id: string }; Returns: boolean }
        | { Args: { gid: string }; Returns: boolean }
      is_system_user: { Args: never; Returns: boolean }
      is_user_suspended: { Args: { _user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          _action_type: string
          _changes?: Json
          _record_id?: string
          _table_name: string
        }
        Returns: undefined
      }
      log_admin_user_action: {
        Args: {
          _action_type: string
          _details?: Json
          _target_email: string
          _target_user_id: string
        }
        Returns: undefined
      }
      log_contact_access: {
        Args: { _access_type: string; _contact_request_id: string }
        Returns: undefined
      }
      log_leadership_application_access: {
        Args: { _action_type: string; _application_id: string }
        Returns: undefined
      }
      log_security_violation: {
        Args: { table_name: string; user_id?: string; violation_type: string }
        Returns: undefined
      }
      mark_group_message_as_read: {
        Args: { _message_id: string }
        Returns: undefined
      }
      mark_messages_as_read: {
        Args: { _recipient_id: string; _sender_id: string }
        Returns: undefined
      }
      remove_friendship: { Args: { friendship_id: string }; Returns: undefined }
      search_profiles: {
        Args: { q: string }
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
          username: string
        }[]
      }
      search_public_profiles: {
        Args: { limit_count?: number; search_text: string }
        Returns: {
          avatar_url: string
          full_name: string
          location: string
          user_id: string
          username: string
        }[]
      }
      send_call_notification: {
        Args: {
          _call_type: string
          _callee_id: string
          _caller_name: string
          _conversation_id: string
          _room_url: string
        }
        Returns: string
      }
      send_call_status_notification: {
        Args: {
          _caller_id: string
          _conversation_id: string
          _room_url?: string
          _status: string
        }
        Returns: string
      }
      send_friend_request: {
        Args: { target_user: string }
        Returns: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
          updated_at: string
          user_high: string | null
          user_low: string | null
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_contact_request_secure: {
        Args: {
          _advertisement_id: string
          _message: string
          _requester_email: string
          _requester_name: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      friend_status: "pending" | "accepted" | "declined" | "blocked"
      group_member_role: "admin" | "moderator" | "member"
      group_type: "community" | "mosque_official" | "study_circle" | "private"
      moderation_action:
        | "warning"
        | "content_removed"
        | "user_suspended"
        | "user_banned"
        | "no_action"
      report_status: "pending" | "under_review" | "resolved" | "dismissed"
      report_type:
        | "hate_speech"
        | "extremism"
        | "harassment"
        | "spam"
        | "violence"
        | "inappropriate_content"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      friend_status: ["pending", "accepted", "declined", "blocked"],
      group_member_role: ["admin", "moderator", "member"],
      group_type: ["community", "mosque_official", "study_circle", "private"],
      moderation_action: [
        "warning",
        "content_removed",
        "user_suspended",
        "user_banned",
        "no_action",
      ],
      report_status: ["pending", "under_review", "resolved", "dismissed"],
      report_type: [
        "hate_speech",
        "extremism",
        "harassment",
        "spam",
        "violence",
        "inappropriate_content",
        "other",
      ],
    },
  },
} as const
