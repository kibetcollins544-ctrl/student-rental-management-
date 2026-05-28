Set-Location "c:\Users\STUDENT\attachment project\student-rental-system"
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')

Write-Host "`n=== Node.js version ===" -ForegroundColor Cyan
node --version
npm --version

Write-Host "`n=== Installing dependencies ===" -ForegroundColor Cyan
npm install

Write-Host "`n=== Running database migration ===" -ForegroundColor Cyan
node src/database/migrate.js

Write-Host "`n=== Seeding demo data ===" -ForegroundColor Cyan
node src/database/seed.js

Write-Host "`n=== All done! Starting server ===" -ForegroundColor Green
Write-Host "Open http://localhost:3000 in your browser" -ForegroundColor Yellow
Write-Host "Login: admin@rental.com / Admin@1234" -ForegroundColor Yellow
node src/server.js
