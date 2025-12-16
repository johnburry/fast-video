export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      channels: {
        Row: {
          id: string
          youtube_channel_id: string
          channel_handle: string
          channel_name: string
          channel_description: string | null
          thumbnail_url: string | null
          subscriber_count: number | null
          video_count: number | null
          created_at: string
          updated_at: string
          last_synced_at: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          youtube_channel_id: string
          channel_handle: string
          channel_name: string
          channel_description?: string | null
          thumbnail_url?: string | null
          subscriber_count?: number | null
          video_count?: number | null
          created_at?: string
          updated_at?: string
          last_synced_at?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          youtube_channel_id?: string
          channel_handle?: string
          channel_name?: string
          channel_description?: string | null
          thumbnail_url?: string | null
          subscriber_count?: number | null
          video_count?: number | null
          created_at?: string
          updated_at?: string
          last_synced_at?: string | null
          is_active?: boolean
        }
      }
      videos: {
        Row: {
          id: string
          channel_id: string
          youtube_video_id: string
          title: string
          description: string | null
          thumbnail_url: string | null
          duration_seconds: number | null
          published_at: string | null
          view_count: number | null
          like_count: number | null
          comment_count: number | null
          has_transcript: boolean
          transcript_language: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          youtube_video_id: string
          title: string
          description?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number | null
          published_at?: string | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          has_transcript?: boolean
          transcript_language?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          youtube_video_id?: string
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number | null
          published_at?: string | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          has_transcript?: boolean
          transcript_language?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transcripts: {
        Row: {
          id: string
          video_id: string
          text: string
          start_time: number
          duration: number
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          text: string
          start_time: number
          duration: number
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          text?: string
          start_time?: number
          duration?: number
          created_at?: string
        }
      }
    }
    Views: {
      search_results: {
        Row: {
          transcript_id: string
          text: string
          start_time: number
          duration: number
          video_id: string
          youtube_video_id: string
          video_title: string
          video_thumbnail: string | null
          published_at: string | null
          video_duration: number | null
          channel_id: string
          channel_handle: string
          channel_name: string
          channel_thumbnail: string | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
