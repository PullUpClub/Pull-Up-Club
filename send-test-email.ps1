# PowerShell script to send a test monthly graphic email
# This will send Parker Gawne's August 2025 graphic

Write-Host "🎯 Pull-Up Club - Send Test Monthly Graphic" -ForegroundColor Cyan
Write-Host "━" * 60 -ForegroundColor Gray
Write-Host ""

$graphicId = "66bea2b5-475c-4a5a-a61e-f88765723512"  # August 2025
$supabaseUrl = "https://yqnikgupiaghgjtsaypr.supabase.co"

Write-Host "📧 Target: parkergawne10@gmail.com" -ForegroundColor Yellow
Write-Host "📅 Month: August 2025" -ForegroundColor Yellow
Write-Host "💪 Pull-ups: 17 (Hardened badge)" -ForegroundColor Yellow
Write-Host ""

# You need to provide your service role key
$serviceRoleKey = Read-Host "Enter your SUPABASE_SERVICE_ROLE_KEY"

if ([string]::IsNullOrWhiteSpace($serviceRoleKey)) {
    Write-Host "❌ Service role key is required!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Sending request to send-monthly-graphics Edge Function..." -ForegroundColor Cyan
Write-Host ""

$body = @{
    action = "send-single"
    graphicIds = @($graphicId)
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $serviceRoleKey"
}

try {
    $response = Invoke-RestMethod -Uri "$supabaseUrl/functions/v1/send-monthly-graphics" -Method Post -Headers $headers -Body $body
    
    Write-Host "✅ Response received!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Results:" -ForegroundColor Cyan
    Write-Host "   Sent: $($response.sent)" -ForegroundColor Green
    Write-Host "   Queued: $($response.queued)" -ForegroundColor Yellow
    Write-Host "   Message: $($response.message)" -ForegroundColor White
    Write-Host ""
    
    if ($response.errors) {
        Write-Host "⚠️  Errors:" -ForegroundColor Red
        $response.errors | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
        Write-Host ""
    }
    
    if ($response.sent -gt 0) {
        Write-Host "━" * 60 -ForegroundColor Gray
        Write-Host ""
        Write-Host "🎉 SUCCESS! Email sent!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Check your inbox at: parkergawne10@gmail.com" -ForegroundColor Cyan
        Write-Host "   Subject: 'Your August 2025 Pull-Up Club Achievement'" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   The email should now include your graphic image! 🖼️" -ForegroundColor Green
        Write-Host ""
        Write-Host "━" * 60 -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host $_.ErrorDetails -ForegroundColor Red
}

