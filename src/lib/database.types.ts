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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          device_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          member_id: string | null
          occurred_at: string
          shop_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          device_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          member_id?: string | null
          occurred_at?: string
          shop_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          device_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          member_id?: string | null
          occurred_at?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_session_id: string | null
          category: string | null
          courier_id: string | null
          created_at: string
          created_by: string | null
          delivery_expense_id: string | null
          device_id: string | null
          id: string
          note: string | null
          occurred_at: string
          payment_method_id: string
          shop_id: string
          type: string
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          category?: string | null
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_expense_id?: string | null
          device_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          payment_method_id: string
          shop_id: string
          type: string
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          category?: string | null
          courier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_expense_id?: string | null
          device_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          payment_method_id?: string
          shop_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_delivery_expense_id_fkey"
            columns: ["delivery_expense_id"]
            isOneToOne: false
            referencedRelation: "delivery_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          counted_amounts: Json | null
          created_at: string
          device_id: string
          difference_amount: number | null
          expected_amounts: Json | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_float: number
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amounts?: Json | null
          created_at?: string
          device_id: string
          difference_amount?: number | null
          expected_amounts?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_float?: number
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amounts?: Json | null
          created_at?: string
          device_id?: string
          difference_amount?: number | null
          expected_amounts?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_float?: number
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          shop_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          shop_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          shop_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          device_id: string | null
          id: string
          note: string | null
          occurred_at: string
          payment_id: string | null
          sale_id: string | null
          shop_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          device_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          payment_id?: string | null
          sale_id?: string | null
          shop_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          device_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          payment_id?: string | null
          sale_id?: string | null
          shop_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          device_id: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          device_id?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          device_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          address: string
          amount_to_collect: number
          assigned_to: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          device_id: string | null
          failed_reason: string | null
          id: string
          landmark: string | null
          note: string | null
          requested_at: string | null
          sale_id: string | null
          shop_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          amount_to_collect?: number
          assigned_to?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          device_id?: string | null
          failed_reason?: string | null
          id?: string
          landmark?: string | null
          note?: string | null
          requested_at?: string | null
          sale_id?: string | null
          shop_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          amount_to_collect?: number
          assigned_to?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          device_id?: string | null
          failed_reason?: string | null
          id?: string
          landmark?: string | null
          note?: string | null
          requested_at?: string | null
          sale_id?: string | null
          shop_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_expenses: {
        Row: {
          amount: number
          category: string
          courier_id: string
          created_at: string
          created_by: string | null
          delivery_id: string | null
          device_id: string | null
          id: string
          note: string | null
          occurred_at: string
          proof_path: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          courier_id: string
          created_at?: string
          created_by?: string | null
          delivery_id?: string | null
          device_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          proof_path: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          courier_id?: string
          created_at?: string
          created_by?: string | null
          delivery_id?: string | null
          device_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          proof_path?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_expenses_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_expenses_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_expenses_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_expenses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_expenses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_number: number
          id: string
          last_seen_at: string | null
          name: string
          platform: string
          registered_by: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          device_number: number
          id: string
          last_seen_at?: string | null
          name: string
          platform: string
          registered_by?: string | null
          shop_id: string
        }
        Update: {
          created_at?: string
          device_number?: number
          id?: string
          last_seen_at?: string | null
          name?: string
          platform?: string
          registered_by?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          created_at: string
          created_by: string | null
          device_id: string | null
          id: string
          notes: string | null
          shop_id: string
          started_at: string
          status: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          notes?: string | null
          shop_id: string
          started_at?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          notes?: string | null
          shop_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lines: {
        Row: {
          counted_quantity: number
          created_at: string
          expected_quantity: number
          id: string
          inventory_count_id: string
          product_id: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          counted_quantity: number
          created_at?: string
          expected_quantity: number
          id?: string
          inventory_count_id: string
          product_id: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          counted_quantity?: number
          created_at?: string
          expected_quantity?: number
          id?: string
          inventory_count_id?: string
          product_id?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lines_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          kind: string
          label: string
          shop_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          kind: string
          label: string
          shop_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          shop_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cash_received: number | null
          cash_session_id: string | null
          change_given: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_id: string | null
          device_id: string | null
          id: string
          kind: string
          occurred_at: string
          payment_method_id: string
          sale_id: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          cash_received?: number | null
          cash_session_id?: string | null
          change_given?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_id?: string | null
          device_id?: string | null
          id?: string
          kind: string
          occurred_at?: string
          payment_method_id: string
          sale_id?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          cash_received?: number | null
          cash_session_id?: string | null
          change_given?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_id?: string | null
          device_id?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          payment_method_id?: string
          sale_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_units: {
        Row: {
          archived_at: string | null
          barcode: string | null
          created_at: string
          factor: number
          id: string
          is_default: boolean
          name: string
          product_id: string
          purchase_price: number | null
          sale_price: number | null
          shop_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          barcode?: string | null
          created_at?: string
          factor: number
          id?: string
          is_default?: boolean
          name: string
          product_id: string
          purchase_price?: number | null
          sale_price?: number | null
          shop_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          barcode?: string | null
          created_at?: string
          factor?: number
          id?: string
          is_default?: boolean
          name?: string
          product_id?: string
          purchase_price?: number | null
          sale_price?: number | null
          shop_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_decimal: boolean
          archived_at: string | null
          barcode: string | null
          base_unit: string
          category_id: string | null
          created_at: string
          created_by: string | null
          device_id: string | null
          id: string
          low_stock_threshold: number | null
          name: string
          photo_path: string | null
          shop_id: string
          track_expiry: boolean
          updated_at: string
        }
        Insert: {
          allow_decimal?: boolean
          archived_at?: string | null
          barcode?: string | null
          base_unit: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          low_stock_threshold?: number | null
          name: string
          photo_path?: string | null
          shop_id: string
          track_expiry?: boolean
          updated_at?: string
        }
        Update: {
          allow_decimal?: boolean
          archived_at?: string | null
          barcode?: string | null
          base_unit?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          low_stock_threshold?: number | null
          name?: string
          photo_path?: string | null
          shop_id?: string
          track_expiry?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          device_id: string | null
          id: string
          kind: string
          notes: string | null
          period_end: string
          period_start: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: Json
          device_id?: string | null
          id?: string
          kind: string
          notes?: string | null
          period_end: string
          period_start: string
          shop_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          device_id?: string | null
          id?: string
          kind?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          base_quantity: number
          created_at: string
          id: string
          line_total: number
          product_id: string
          product_name: string
          product_unit_id: string
          quantity: number
          sale_id: string
          shop_id: string
          unit_factor: number
          unit_name: string
          unit_price: number
        }
        Insert: {
          base_quantity: number
          created_at?: string
          id?: string
          line_total: number
          product_id: string
          product_name: string
          product_unit_id: string
          quantity: number
          sale_id: string
          shop_id: string
          unit_factor: number
          unit_name: string
          unit_price: number
        }
        Update: {
          base_quantity?: number
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string
          product_name?: string
          product_unit_id?: string
          quantity?: number
          sale_id?: string
          shop_id?: string
          unit_factor?: number
          unit_name?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_session_id: string | null
          created_at: string
          customer_id: string | null
          device_id: string
          discount_amount: number
          due_amount: number
          id: string
          invoice_number: string
          invoice_seq: number
          note: string | null
          occurred_at: string
          paid_amount: number
          replaces_sale_id: string | null
          seller_id: string
          shop_id: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_session_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_id: string
          discount_amount?: number
          due_amount: number
          id?: string
          invoice_number: string
          invoice_seq: number
          note?: string | null
          occurred_at?: string
          paid_amount: number
          replaces_sale_id?: string | null
          seller_id: string
          shop_id: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_session_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_id?: string
          discount_amount?: number
          due_amount?: number
          id?: string
          invoice_number?: string
          invoice_seq?: number
          note?: string | null
          occurred_at?: string
          paid_amount?: number
          replaces_sale_id?: string | null
          seller_id?: string
          shop_id?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_replaces_sale_id_fkey"
            columns: ["replaces_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_member_roles: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          member_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_member_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_member_roles_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_member_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          access_level: string
          active: boolean
          created_at: string
          display_name: string
          id: string
          max_discount_percent: number | null
          pin_hash: string | null
          pin_salt: string | null
          shop_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_level?: string
          active?: boolean
          created_at?: string
          display_name: string
          id?: string
          max_discount_percent?: number | null
          pin_hash?: string | null
          pin_salt?: string | null
          shop_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_level?: string
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          max_discount_percent?: number | null
          pin_hash?: string | null
          pin_salt?: string | null
          shop_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          allow_sale_without_stock: boolean
          country_code: string
          created_at: string
          currency_code: string
          expiry_alert_days_first: number
          expiry_alert_days_second: number
          id: string
          invoice_footer: string | null
          logo_path: string | null
          name: string
          paid_until: string | null
          phone: string | null
          provisional_until: string | null
          return_window_hours: number
          seller_max_discount_percent: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_sale_without_stock?: boolean
          country_code?: string
          created_at?: string
          currency_code?: string
          expiry_alert_days_first?: number
          expiry_alert_days_second?: number
          id?: string
          invoice_footer?: string | null
          logo_path?: string | null
          name: string
          paid_until?: string | null
          phone?: string | null
          provisional_until?: string | null
          return_window_hours?: number
          seller_max_discount_percent?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_sale_without_stock?: boolean
          country_code?: string
          created_at?: string
          currency_code?: string
          expiry_alert_days_first?: number
          expiry_alert_days_second?: number
          id?: string
          invoice_footer?: string | null
          logo_path?: string | null
          name?: string
          paid_until?: string | null
          phone?: string | null
          provisional_until?: string | null
          return_window_hours?: number
          seller_max_discount_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_lots: {
        Row: {
          cost_price: number
          cost_quantity: number
          created_at: string
          created_by: string | null
          device_id: string | null
          expiry_date: string | null
          id: string
          initial_quantity: number
          product_id: string
          receipt_id: string | null
          received_at: string
          shop_id: string
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          cost_price: number
          cost_quantity: number
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          expiry_date?: string | null
          id?: string
          initial_quantity: number
          product_id: string
          receipt_id?: string | null
          received_at?: string
          shop_id: string
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          cost_price?: number
          cost_quantity?: number
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          expiry_date?: string | null
          id?: string
          initial_quantity?: number
          product_id?: string
          receipt_id?: string | null
          received_at?: string
          shop_id?: string
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "stock_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          cost_amount: number
          created_at: string
          created_by: string | null
          device_id: string | null
          id: string
          inventory_count_id: string | null
          loss_reason: string | null
          lot_id: string | null
          note: string | null
          occurred_at: string
          product_id: string
          quantity: number
          receipt_id: string | null
          sale_id: string | null
          sale_item_id: string | null
          shop_id: string
          type: string
        }
        Insert: {
          cost_amount?: number
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          inventory_count_id?: string | null
          loss_reason?: string | null
          lot_id?: string | null
          note?: string | null
          occurred_at?: string
          product_id: string
          quantity: number
          receipt_id?: string | null
          sale_id?: string | null
          sale_item_id?: string | null
          shop_id: string
          type: string
        }
        Update: {
          cost_amount?: number
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          inventory_count_id?: string | null
          loss_reason?: string | null
          lot_id?: string | null
          note?: string | null
          occurred_at?: string
          product_id?: string
          quantity?: number
          receipt_id?: string | null
          sale_id?: string | null
          sale_item_id?: string | null
          shop_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "stock_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "stock_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          device_id: string | null
          id: string
          notes: string | null
          received_at: string
          reference: string | null
          shop_id: string
          supplier_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          notes?: string | null
          received_at?: string
          reference?: string | null
          shop_id: string
          supplier_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          notes?: string | null
          received_at?: string
          reference?: string | null
          shop_id?: string
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          declared_by: string | null
          id: string
          message: string | null
          monthly_price: number
          months: number
          operator: string
          paid_at: string | null
          proof_path: string | null
          provisional_until: string | null
          reference: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_phone: string
          shop_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          declared_by?: string | null
          id?: string
          message?: string | null
          monthly_price: number
          months: number
          operator: string
          paid_at?: string | null
          proof_path?: string | null
          provisional_until?: string | null
          reference: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone: string
          shop_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          declared_by?: string | null
          id?: string
          message?: string | null
          monthly_price?: number
          months?: number
          operator?: string
          paid_at?: string | null
          proof_path?: string | null
          provisional_until?: string | null
          reference?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone?: string
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          member_id: string
          revoked_at: string | null
          shop_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at: string
          id?: string
          member_id: string
          revoked_at?: string | null
          shop_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          member_id?: string
          revoked_at?: string | null
          shop_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "shop_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: {
        Args: {
          p_code: string
          p_display_name: string
          p_pin_hash: string
          p_pin_salt: string
        }
        Returns: string
      }
      admin_overview: {
        Args: never
        Returns: {
          payments_pending: number
          revenue_this_month: number
          revenue_total: number
          shops_active: number
          shops_expired: number
          shops_grace: number
          shops_new_30_days: number
          shops_total: number
          shops_trial: number
        }[]
      }
      admin_subscription_payments: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          id: string
          message: string
          months: number
          operator: string
          owner_email: string
          paid_at: string
          paid_until: string
          proof_path: string
          provisional_until: string
          reference: string
          review_note: string
          sender_phone: string
          shop_id: string
          shop_name: string
          shop_phone: string
          status: string
        }[]
      }
      am_i_platform_admin: { Args: never; Returns: boolean }
      apply_changes: { Args: { p_changes: Json }; Returns: undefined }
      create_shop: {
        Args: {
          p_country_code: string
          p_currency_code: string
          p_name: string
          p_owner_name: string
          p_payment_methods: Json
        }
        Returns: string
      }
      create_team_invite: {
        Args: { p_email: string; p_member_id: string }
        Returns: {
          invite_code: string
          invite_expires_at: string
        }[]
      }
      declare_subscription_payment: {
        Args: {
          p_message: string
          p_months: number
          p_operator: string
          p_paid_at: string
          p_proof_path: string
          p_reference: string
          p_sender_phone: string
          p_shop_id: string
        }
        Returns: {
          payment_id: string
          provisional_until: string
        }[]
      }
      get_team_invite: {
        Args: { p_code: string }
        Returns: {
          invite_status: string
          member_name: string
          member_roles: string[]
          shop_name: string
          suggested_email: string
        }[]
      }
      invite_team_member: {
        Args: {
          p_display_name: string
          p_email: string
          p_roles: string[]
          p_shop_id: string
        }
        Returns: {
          invite_code: string
          invite_expires_at: string
          member_id: string
        }[]
      }
      my_membership_status: { Args: never; Returns: string }
      register_device: {
        Args: {
          p_device_id: string
          p_name: string
          p_platform: string
          p_shop_id: string
        }
        Returns: number
      }
      reset_shop_data: {
        Args: { p_confirmation: string; p_shop_id: string }
        Returns: undefined
      }
      review_subscription_payment: {
        Args: { p_accept: boolean; p_note: string; p_payment_id: string }
        Returns: undefined
      }
      revoke_team_invite: { Args: { p_member_id: string }; Returns: undefined }
      subscription_quote: {
        Args: { p_shop_id: string }
        Returns: {
          average_revenue: number
          monthly_price: number
          reason: string
        }[]
      }
      update_my_member_profile: {
        Args: { p_display_name: string; p_pin_hash: string; p_pin_salt: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
