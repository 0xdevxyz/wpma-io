#!/bin/bash
# Apply WPMA fixes to host source files
# Run this as root from /home/clawd/saas/wpma-io/
# Then rebuild: docker compose build backend && docker compose up -d backend

cd /home/clawd/saas/wpma-io

# Fix 1: Add plugin_file to /plugins REST endpoint in wpma-agent.php
sed -i "s/                    'slug'             => \$slug,\n                    'version'/                    'slug'             => \$slug,\n                    'plugin_file'      => \$file,\n                    'version'/" wpma-agent/wpma-agent.php

# Fix 6: Add plugin_count to class-wpma-core.php collect_health_data()
sed -i "s/'active_plugins' => \$this->get_active_plugins(),/'plugin_count' => count(get_option('active_plugins', array())),\n            'active_plugins' => \$this->get_active_plugins(),/" wpma-agent/includes/class-wpma-core.php

echo "Fixes applied. Now rebuild:"
echo "docker compose build backend && docker compose up -d backend"
echo "docker compose build frontend && docker compose up -d frontend"
