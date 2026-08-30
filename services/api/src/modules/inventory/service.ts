import type pg from "pg";
import { ApiError } from "../../errors.js";

export interface OrderItemForReservation {
  item_type: string;
  item_id: string;
  quantity: number;
}

/**
 * Reserves stock for every `variant` line item in a new order, per
 * docs/blueprint/12-inventory-engine.md, sections 2-3 (Available to Sell =
 * available_qty - reserved_qty). `service`/`package` items are not
 * inventory-tracked and are skipped, as are `variant` items with no
 * inventory.stock row at all (untracked product).
 *
 * Must run inside the same transaction as the order/order_items insert:
 * throwing here (insufficient stock) rolls the whole order back.
 */
export async function reserveStockForOrder(
  client: pg.PoolClient,
  storeId: string,
  orderId: string,
  items: OrderItemForReservation[],
): Promise<void> {
  for (const item of items) {
    if (item.item_type !== "variant") continue;

    // MVP simplification: a store's stock for a variant is expected to
    // live in a single warehouse (mirrors the single-default-branch
    // simplification elsewhere in this MVP slice). If it is split across
    // several, we reserve from whichever has the most availability rather
    // than splitting one order line across warehouses.
    const stockRows = await client.query<{
      warehouse_id: string;
      available_qty: string;
      reserved_qty: string;
    }>(
      `select s.warehouse_id, s.available_qty, s.reserved_qty
       from inventory.stock s
       join inventory.warehouses w on w.id = s.warehouse_id
       where w.store_id = $1 and s.variant_id = $2
       order by (s.available_qty - s.reserved_qty) desc
       limit 1`,
      [storeId, item.item_id],
    );

    if (stockRows.rowCount === 0) continue; // not inventory-tracked

    const stock = stockRows.rows[0];
    const availableToSell = Number(stock.available_qty) - Number(stock.reserved_qty);
    if (item.quantity > availableToSell) {
      throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock available for variant ${item.item_id}`, {
        variant_id: item.item_id,
        requested: item.quantity,
        available_to_sell: availableToSell,
      });
    }

    await client.query(
      `update inventory.stock set reserved_qty = reserved_qty + $1
       where warehouse_id = $2 and variant_id = $3`,
      [item.quantity, stock.warehouse_id, item.item_id],
    );

    await client.query(
      `insert into inventory.inventory_reservations (store_id, variant_id, order_id, quantity, status, expires_at)
       values ($1, $2, $3, $4, 'ACTIVE', now() + interval '30 minutes')`,
      [storeId, item.item_id, orderId, item.quantity],
    );

    await client.query(
      `insert into inventory.stock_movements (store_id, warehouse_id, variant_id, type, quantity, reference_type, reference_id)
       values ($1, $2, $3, 'RESERVATION', $4, 'order', $5)`,
      [storeId, stock.warehouse_id, item.item_id, item.quantity, orderId],
    );
  }
}

/**
 * Converts every ACTIVE reservation for an order into an actual SALE stock
 * movement (called on successful payment capture) — per
 * docs/blueprint/12-inventory-engine.md, section 3.
 */
export async function consumeReservationsForOrder(client: pg.PoolClient, orderId: string): Promise<void> {
  const reservations = await client.query<{
    id: string;
    store_id: string;
    variant_id: string;
    quantity: string;
  }>("select id, store_id, variant_id, quantity from inventory.inventory_reservations where order_id = $1 and status = 'ACTIVE'", [
    orderId,
  ]);

  for (const reservation of reservations.rows) {
    const quantity = Number(reservation.quantity);

    const warehouse = await client.query<{ warehouse_id: string }>(
      `select s.warehouse_id
       from inventory.stock s
       join inventory.warehouses w on w.id = s.warehouse_id
       where w.store_id = $1 and s.variant_id = $2 and s.reserved_qty >= $3
       order by s.reserved_qty desc
       limit 1`,
      [reservation.store_id, reservation.variant_id, quantity],
    );
    if (warehouse.rowCount === 0) continue; // should not happen; nothing to consume against

    await client.query(
      `update inventory.stock set available_qty = available_qty - $1, reserved_qty = reserved_qty - $1
       where warehouse_id = $2 and variant_id = $3`,
      [quantity, warehouse.rows[0].warehouse_id, reservation.variant_id],
    );
    await client.query("update inventory.inventory_reservations set status = 'CONSUMED' where id = $1", [
      reservation.id,
    ]);
    await client.query(
      `insert into inventory.stock_movements (store_id, warehouse_id, variant_id, type, quantity, reference_type, reference_id)
       values ($1, $2, $3, 'SALE', $4, 'order', $5)`,
      [reservation.store_id, warehouse.rows[0].warehouse_id, reservation.variant_id, -quantity, orderId],
    );
  }
}

/**
 * Releases every ACTIVE reservation for an order back to available stock
 * (called on order cancellation) — per
 * docs/blueprint/12-inventory-engine.md, section 3.
 */
export async function releaseReservationsForOrder(client: pg.PoolClient, orderId: string): Promise<void> {
  const reservations = await client.query<{
    id: string;
    store_id: string;
    variant_id: string;
    quantity: string;
  }>("select id, store_id, variant_id, quantity from inventory.inventory_reservations where order_id = $1 and status = 'ACTIVE'", [
    orderId,
  ]);

  for (const reservation of reservations.rows) {
    const quantity = Number(reservation.quantity);

    const warehouse = await client.query<{ warehouse_id: string }>(
      `select s.warehouse_id
       from inventory.stock s
       join inventory.warehouses w on w.id = s.warehouse_id
       where w.store_id = $1 and s.variant_id = $2 and s.reserved_qty >= $3
       order by s.reserved_qty desc
       limit 1`,
      [reservation.store_id, reservation.variant_id, quantity],
    );
    if (warehouse.rowCount === 0) continue;

    await client.query(`update inventory.stock set reserved_qty = reserved_qty - $1 where warehouse_id = $2 and variant_id = $3`, [
      quantity,
      warehouse.rows[0].warehouse_id,
      reservation.variant_id,
    ]);
    await client.query("update inventory.inventory_reservations set status = 'RELEASED' where id = $1", [
      reservation.id,
    ]);
    await client.query(
      `insert into inventory.stock_movements (store_id, warehouse_id, variant_id, type, quantity, reference_type, reference_id)
       values ($1, $2, $3, 'RELEASE', $4, 'order', $5)`,
      [reservation.store_id, warehouse.rows[0].warehouse_id, reservation.variant_id, quantity, orderId],
    );
  }
}
