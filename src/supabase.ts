import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type UserRole =
  | "super_admin"
  | "production_admin" | "production"
  | "warehouse_admin" | "warehouse_receiving" | "warehouse_withdrawal"
  | "sales_admin" | "sales"
  | "stock_manager_admin" | "stock_manager"
  | "qa_admin" | "qa_officer"
  | "report_viewer";

export type BoxStatus =
  | "logged" | "in_stock" | "on_hold" | "expired"
  | "dispatched_sale" | "dispatched_non_sale"
  | "damaged_pending" | "written_off" | "returned_to_stock";

export type OrderStatus =
  | "pending" | "ready_to_pick" | "partially_fulfilled" | "dispatched" | "cancelled" | "short";

export type DamageSource = "factory" | "warehouse" | "customer_returned";
export type DamageStatus = "pending_approval" | "approved_writeoff" | "approved_return_to_stock" | "rejected";
export type NonSaleCategory = "gift" | "promotion" | "personal_use";

export interface Profile {
  id: string; username: string; full_name: string; role: UserRole;
  is_active: boolean; is_banned: boolean; failed_login_count: number;
  lockout_until: string | null; two_factor_enabled: boolean;
  must_change_password: boolean; created_at: string; updated_at: string;
}
export interface Product {
  id: string; product_code: string; name: string;
  reorder_point: number | null; shelf_life_days: number | null;
  price: number; discount_threshold: number | null; discount_percentage: number | null;
  is_active: boolean; created_at: string; updated_at: string;
}
export interface Box {
  id: string; code: string; product_id: string; status: BoxStatus;
  batch_number: string; manufacturing_date: string; notes: string | null;
  logged_by_user_id: string | null; logged_at: string;
  received_by_user_id: string | null; received_at: string | null;
  expiry_date: string | null; created_at: string; updated_at: string;
}
export interface Customer {
  id: string; name: string; phone: string | null; address: string | null;
  created_by_user_id: string | null; created_at: string; updated_at: string;
}
export interface Order {
  id: string; order_number: string; customer_id: string;
  sales_person_user_id: string | null; status: OrderStatus;
  total_amount: number;
  order_date: string; dispatched_at: string | null; created_at: string; updated_at: string;
}
export interface OrderLine {
  id: string; order_id: string; product_id: string;
  quantity_requested: number; quantity_fulfilled: number;
  unit_price: number; discount_applied: number; line_total: number;
}
export interface DamageReport {
  id: string; box_id: string; source: DamageSource; reason: string | null;
  photo_url: string | null; reported_by_user_id: string | null;
  status: DamageStatus; decided_by_user_id: string | null;
  decision_note: string | null; order_id: string | null;
  created_at: string; decided_at: string | null;
}
export interface QualityHold {
  id: string; box_id: string; placed_by_user_id: string | null;
  reason: string; status: "active" | "released";
  released_by_user_id: string | null; created_at: string; released_at: string | null;
}
export interface UserProductAccess { id: string; user_id: string; product_id: string; }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
