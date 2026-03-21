#\!/bin/bash
set -e
echo Syncing uptime monitoring files from backend container to main repo...
docker cp wpma-backend:/app/src/services/uptimeService.js /home/clawd/saas/wpma-io/src/services/uptimeService.js
docker cp wpma-backend:/app/src/routes/uptime.js /home/clawd/saas/wpma-io/src/routes/uptime.js
docker cp wpma-backend:/app/src/index.js /home/clawd/saas/wpma-io/src/index.js
docker cp wpma-backend:/app/src/services/jobService.js /home/clawd/saas/wpma-io/src/services/jobService.js
docker cp wpma-backend:/app/src/services/notificationService.js /home/clawd/saas/wpma-io/src/services/notificationService.js
docker cp wpma-backend:/app/src/controllers/sitesController.js /home/clawd/saas/wpma-io/src/controllers/sitesController.js
echo All backend files synced.
