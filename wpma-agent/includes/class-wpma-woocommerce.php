<?php
/**
 * WPMA WooCommerce Revenue Intelligence
 *
 * Sammelt WooCommerce-Metriken und sendet sie täglich an die wpma.io API.
 * Erfasst außerdem Echtzeit-Events (Bestellungen, Abbrüche) für sofortige Korrelation.
 */

if (!defined('ABSPATH')) exit;
if (class_exists('WPMA_WooCommerce')) return;

class WPMA_WooCommerce {

    private $api;
    private $site_id;

    public function __construct($api_instance, $site_id) {
        $this->api     = $api_instance;
        $this->site_id = $site_id;
    }

    public function init() {
        if (!class_exists('WooCommerce')) return;

        // Täglicher Snapshot-Cron
        if (!wp_next_scheduled('wpma_woo_daily_snapshot')) {
            wp_schedule_event(time(), 'daily', 'wpma_woo_daily_snapshot');
        }
        add_action('wpma_woo_daily_snapshot', [$this, 'send_daily_snapshot']);

        // Echtzeit-Events
        add_action('woocommerce_order_status_completed',  [$this, 'on_order_completed'],  10, 1);
        add_action('woocommerce_order_status_refunded',   [$this, 'on_order_refunded'],   10, 1);
        add_action('woocommerce_checkout_order_processed', [$this, 'on_checkout'],        10, 1);
        add_action('woocommerce_cart_emptied',            [$this, 'on_cart_abandoned'],   10, 0);
    }

    // ─── Täglicher Snapshot ──────────────────────────────────────────────────

    public function send_daily_snapshot() {
        $data = $this->collect_snapshot('yesterday');
        if (!$data) return;
        $this->api->post('/revenue/' . $this->site_id . '/snapshot', $data);
    }

    public function collect_snapshot($period = 'today') {
        if (!function_exists('wc_get_orders')) return null;

        $date_query = $this->get_date_range($period);

        $orders = wc_get_orders([
            'status'       => ['completed', 'processing'],
            'date_created' => $date_query['after'] . '...' . $date_query['before'],
            'limit'        => -1,
            'return'       => 'objects',
        ]);

        $refunded_orders = wc_get_orders([
            'status'       => ['refunded'],
            'date_created' => $date_query['after'] . '...' . $date_query['before'],
            'limit'        => -1,
            'return'       => 'objects',
        ]);

        $total_revenue   = 0;
        $order_count     = count($orders);
        $new_customers   = 0;
        $returning       = 0;
        $customer_ids    = [];

        foreach ($orders as $order) {
            $total_revenue += (float) $order->get_total();
            $customer_id = $order->get_customer_id();
            if ($customer_id) {
                $customer_ids[] = $customer_id;
                $order_count_before = wc_get_customer_order_count($customer_id);
                if ($order_count_before <= 1) $new_customers++;
                else $returning++;
            }
        }

        $refund_amount = 0;
        foreach ($refunded_orders as $order) {
            $refund_amount += abs((float) $order->get_total());
        }

        $avg_order_value = $order_count > 0 ? $total_revenue / $order_count : 0;

        // Conversion Rate (Bestellungen / Seitenbesuche)
        $visits = (int) get_option('wpma_daily_visits', 0);
        $conversion_rate = $visits > 0 ? $order_count / $visits : 0;

        // Cart Abandonment
        $cart_sessions   = (int) get_option('wpma_cart_sessions_' . date('Y-m-d'), 0);
        $cart_abnd_rate  = ($cart_sessions > 0 && $cart_sessions > $order_count)
            ? ($cart_sessions - $order_count) / $cart_sessions
            : 0;

        return [
            'period_start'           => $date_query['after'],
            'period_end'             => $date_query['before'],
            'total_revenue'          => round($total_revenue, 2),
            'order_count'            => $order_count,
            'avg_order_value'        => round($avg_order_value, 2),
            'conversion_rate'        => round($conversion_rate, 4),
            'cart_abandonment_rate'  => round($cart_abnd_rate, 4),
            'refund_amount'          => round($refund_amount, 2),
            'new_customers'          => $new_customers,
            'returning_customers'    => $returning,
            'raw_data'               => [
                'currency'   => get_woocommerce_currency(),
                'tax_total'  => array_sum(array_map(fn($o) => (float)$o->get_total_tax(), $orders)),
                'wp_version' => get_bloginfo('version'),
                'woo_version'=> WC_VERSION,
            ],
        ];
    }

    // ─── Echtzeit-Events ─────────────────────────────────────────────────────

    public function on_order_completed($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) return;
        $this->api->post('/revenue/' . $this->site_id . '/event', [
            'event_type' => 'order_completed',
            'amount'     => (float) $order->get_total(),
            'metadata'   => [
                'order_id'  => $order_id,
                'items'     => $order->get_item_count(),
                'customer'  => $order->get_customer_id() ? 'returning' : 'guest',
            ],
        ]);
    }

    public function on_order_refunded($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) return;
        $this->api->post('/revenue/' . $this->site_id . '/event', [
            'event_type' => 'order_refunded',
            'amount'     => (float) $order->get_total(),
            'metadata'   => ['order_id' => $order_id],
        ]);
    }

    public function on_checkout($order_id) {
        $this->api->post('/revenue/' . $this->site_id . '/event', [
            'event_type' => 'checkout_started',
            'amount'     => null,
            'metadata'   => ['order_id' => $order_id],
        ]);
    }

    public function on_cart_abandoned() {
        // Increment cart session counter
        $key = 'wpma_cart_sessions_' . date('Y-m-d');
        update_option($key, (int)get_option($key, 0) + 1);
    }

    // ─── Hilfsfunktionen ─────────────────────────────────────────────────────

    private function get_date_range($period) {
        switch ($period) {
            case 'today':
                return ['after' => date('Y-m-d') . 'T00:00:00', 'before' => date('Y-m-d') . 'T23:59:59'];
            case 'yesterday':
                $y = date('Y-m-d', strtotime('-1 day'));
                return ['after' => $y . 'T00:00:00', 'before' => $y . 'T23:59:59'];
            case 'last_7_days':
                return ['after' => date('Y-m-d', strtotime('-7 days')) . 'T00:00:00', 'before' => date('Y-m-d') . 'T23:59:59'];
            default:
                return ['after' => date('Y-m-d') . 'T00:00:00', 'before' => date('Y-m-d') . 'T23:59:59'];
        }
    }

    // Besuchszähler (einfach, ohne Extra-Plugin)
    public static function track_visit() {
        if (is_admin() || wp_doing_ajax()) return;
        $key = 'wpma_daily_visits';
        $last_reset = get_option('wpma_visits_last_reset', '');
        $today = date('Y-m-d');
        if ($last_reset !== $today) {
            update_option($key, 1);
            update_option('wpma_visits_last_reset', $today);
        } else {
            update_option($key, (int)get_option($key, 0) + 1);
        }
    }
}
