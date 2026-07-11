#!/bin/bash
set -e
echo "=== CleanStock Vercel Build ==="

# Build dashboard
echo "--- Building Dashboard ---"
cd dashboard || exit 1
npm install --no-fund --no-audit
npm run build
cd ..

# Build mobile PWA (builds to mobile/dist/ with base /empleado/)
echo "--- Building Mobile PWA ---"
cd mobile || exit 1
npm install --no-fund --no-audit
npm run build
cd ..

# Copy mobile dist into dashboard dist under /empleado/
echo "--- Merging outputs ---"
rm -rf dashboard/dist/empleado
cp -r mobile/dist dashboard/dist/empleado

# Install API deps + generate Prisma client
echo "--- Installing API dependencies ---"
npm install --no-fund --no-audit
npx prisma generate

echo "=== Build complete ==="