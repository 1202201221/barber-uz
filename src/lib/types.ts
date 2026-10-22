export type AppRole = "customer" | "barber" | "owner" | "admin";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          role: AppRole;
          locale: string;
          created_at: string;
        };
        Insert: Partial<Record<keyof Database["public"]["Tables"]["profiles"]["Row"], unknown>>;
        Update: Database["public"]["Tables"]["profiles"]["Insert"];
        Relationships: [];
      };
      salons: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string;
          phone: string | null;
          address: string;
          city: string;
          district: string | null;
          latitude: number | null;
          longitude: number | null;
          status: "pending" | "approved" | "rejected";
          created_at: string;
        };
        Insert: Partial<Record<keyof Database["public"]["Tables"]["salons"]["Row"], unknown>>;
        Update: Database["public"]["Tables"]["salons"]["Insert"];
        Relationships: [
          {
            foreignKeyName: "salons_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      barbers: {
        Row: {
          id: string;
          profile_id: string | null;
          salon_id: string;
          display_name: string;
          bio: string;
          experience_years: number;
          photo_url: string | null;
          is_active: boolean;
        };
        Insert: Partial<Record<keyof Database["public"]["Tables"]["barbers"]["Row"], unknown>>;
        Update: Database["public"]["Tables"]["barbers"]["Insert"];
        Relationships: [
          {
            foreignKeyName: "barbers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "barbers_salon_id_fkey";
            columns: ["salon_id"];
            isOneToOne: false;
            referencedRelation: "salons";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          salon_id: string;
          barber_id: string | null;
          name: string;
          price: number;
          duration_minutes: number;
          is_active: boolean;
        };
        Insert: Partial<Record<keyof Database["public"]["Tables"]["services"]["Row"], unknown>>;
        Update: Database["public"]["Tables"]["services"]["Insert"];
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey";
            columns: ["salon_id"];
            isOneToOne: false;
            referencedRelation: "salons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "services_barber_id_fkey";
            columns: ["barber_id"];
            isOneToOne: false;
            referencedRelation: "barbers";
            referencedColumns: ["id"];
          },
        ];
      };
      working_hours: {
        Row: {
          id: string;
          barber_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Insert: Partial<Record<keyof Database["public"]["Tables"]["working_hours"]["Row"], unknown>>;
        Update: Database["public"]["Tables"]["working_hours"]["Insert"];
        Relationships: [
          {
            foreignKeyName: "working_hours_barber_id_fkey";
            columns: ["barber_id"];
            isOneToOne: false;
            referencedRelation: "barbers";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          customer_id: string | null;
          barber_id: string;
          service_id: string;
          customer_name: string;
          customer_phone: string;
          starts_at: string;
          ends_at: string;
          price_snapshot: number;
          status: BookingStatus;
          created_at: string;
        };
        Insert: Partial<Record<keyof Database["public"]["Tables"]["bookings"]["Row"], unknown>>;
        Update: Database["public"]["Tables"]["bookings"]["Insert"];
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_barber_id_fkey";
            columns: ["barber_id"];
            isOneToOne: true;
            referencedRelation: "barbers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: true;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          customer_id: string;
          barber_id: string;
          rating: number;
          comment: string;
          created_at: string;
        };
        Insert: Partial<Record<keyof Database["public"]["Tables"]["reviews"]["Row"], unknown>>;
        Update: Database["public"]["Tables"]["reviews"]["Insert"];
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_booking: {
        Args: {
          p_barber_id: string;
          p_service_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_starts_at: string;
        };
        Returns: {
          booking_id: string;
          sms_id: string | null;
          sms_to: string | null;
          sms_body: string | null;
        };
      };
      mark_sms: {
        Args: {
          p_sms_id: string;
          p_status: string;
          p_provider_id?: string | null;
          p_error?: string | null;
        };
        Returns: undefined;
      };
      available_slots: {
        Args: { p_barber_id: string; p_service_id: string; p_days?: number };
        Returns: { starts_at: string }[];
      };
      cancel_own_booking: {
        Args: { p_booking_id: string };
        Returns: undefined;
      };
      owner_update_booking: {
        Args: { p_booking_id: string; p_status: BookingStatus };
        Returns: undefined;
      };
      owner_create_salon: {
        Args: {
          p_name: string;
          p_description: string;
          p_phone: string;
          p_address: string;
          p_city: string;
          p_district: string;
        };
        Returns: string;
      };
      admin_approve_salon: {
        Args: { p_salon_id: string; p_approved: boolean };
        Returns: undefined;
      };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      booking_status: BookingStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Salon = Database["public"]["Tables"]["salons"]["Row"];
export type Barber = Database["public"]["Tables"]["barbers"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type JsonValue = Json;
