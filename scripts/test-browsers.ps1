# Cross-Browser Test Runner (PowerShell)
# Runs Playwright tests across all three browsers and generates a summary

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Cross-Browser E2E Test Suite" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$browsers = @("chromium", "firefox", "webkit")
$results = @{}

# Run tests for each browser
foreach ($browser in $browsers) {
    Write-Host "Running tests on $browser..." -ForegroundColor Yellow
    Write-Host "-----------------------------------"
    
    $output = npx playwright test --project=$browser --reporter=list 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        $results[$browser] = "PASSED"
        Write-Host "✓ $browser tests passed" -ForegroundColor Green
    } else {
        $results[$browser] = "FAILED"
        Write-Host "✗ $browser tests failed" -ForegroundColor Red
    }
    Write-Host ""
}

# Summary
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

$allPassed = $true
foreach ($browser in $browsers) {
    $status = $results[$browser]
    if ($status -eq "PASSED") {
        Write-Host "✓ ${browser}: $status" -ForegroundColor Green
    } else {
        Write-Host "✗ ${browser}: $status" -ForegroundColor Red
        $allPassed = $false
    }
}
Write-Host ""

if ($allPassed) {
    Write-Host "All browsers passed! ✓" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some browsers failed. ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "To debug failures:"
    foreach ($browser in $browsers) {
        if ($results[$browser] -eq "FAILED") {
            Write-Host "  npx playwright test --project=$browser --debug"
        }
    }
    exit 1
}
