-- 003_update_production_box.sql

-- 1. Add new columns to boxes table
ALTER TABLE boxes
ADD COLUMN IF NOT EXISTS batch_number text,
ADD COLUMN IF NOT EXISTS manufacturing_date date,
ADD COLUMN IF NOT EXISTS notes text;

-- 2. Update log_box RPC function
CREATE OR REPLACE FUNCTION log_box(
  p_code text, 
  p_product_id uuid,
  p_batch_number text,
  p_manufacturing_date date,
  p_expiry_date date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role user_role;
  v_existing boxes%ROWTYPE;
  v_product products%ROWTYPE;
  v_box boxes%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('super_admin','production','production_admin') THEN
    RAISE EXCEPTION 'Only Production roles may log boxes.';
  END IF;
  IF v_role IN ('production','production_admin') AND NOT current_user_has_product_access(p_product_id) THEN
    RAISE EXCEPTION 'You do not have access to this product.';
  END IF;

  -- existing code? return full detail (the "show what it already is" behavior)
  SELECT * INTO v_existing FROM boxes WHERE code = p_code LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_product FROM products WHERE id = v_existing.product_id;
    RETURN jsonb_build_object(
      'exists', true,
      'box', jsonb_build_object(
        'id', v_existing.id, 'code', v_existing.code, 'status', v_existing.status,
        'product_id', v_existing.product_id, 'product_code', v_product.product_code,
        'product_name', v_product.name, 'logged_at', v_existing.logged_at,
        'received_at', v_existing.received_at, 'expiry_date', v_existing.expiry_date
      ),
      'message', 'This code is already logged: ' || v_product.product_code || ' — ' || v_product.name
        || ', currently ' || v_existing.status::text || '.'
    );
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or inactive.'; END IF;

  IF p_batch_number IS NULL OR p_manufacturing_date IS NULL OR p_expiry_date IS NULL THEN
    RAISE EXCEPTION 'Batch Number, Manufacturing Date, and Expiry Date are required.';
  END IF;

  IF p_expiry_date <= p_manufacturing_date THEN
    RAISE EXCEPTION 'Expiry date must be after manufacturing date.';
  END IF;

  INSERT INTO boxes (
    code, product_id, batch_number, manufacturing_date, notes, 
    status, logged_by_user_id, logged_at, expiry_date
  )
  VALUES (
    p_code, p_product_id, p_batch_number, p_manufacturing_date, p_notes, 
    'logged', auth.uid(), now(), p_expiry_date
  )
  RETURNING * INTO v_box;

  -- Required audit format: Action = Box Created, Previous Status = None, New Status = Logged
  PERFORM write_audit('Box Created', 'box', v_box.id,
    jsonb_build_object(
      'code', p_code, 
      'product', v_product.product_code,
      'batch_number', p_batch_number,
      'previous_status', 'None',
      'new_status', 'logged'
    )
  );

  RETURN jsonb_build_object(
    'exists', false,
    'box', jsonb_build_object(
      'id', v_box.id, 'code', v_box.code, 'status', v_box.status,
      'product_id', v_box.product_id, 'product_code', v_product.product_code,
      'product_name', v_product.name, 'expiry_date', v_box.expiry_date
    ),
    'message', 'New box logged: ' || v_product.product_code || ' — ' || v_product.name
  );
END;
$$;
