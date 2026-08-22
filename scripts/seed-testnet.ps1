# Seed testnet with realistic campaign data for local development and testing
# Usage: .\scripts\seed-testnet.ps1 [OPTIONS]

param(
    [string]$Network = "testnet",
    [string]$Creator = $env:CREATOR,
    [string]$Token = $env:TOKEN,
    [string]$RegistryId = $env:REGISTRY_ID,
    [int]$NumCampaigns = 5,
    [switch]$Verbose,
    [switch]$Help
)

# Color functions
function Write-Info { Write-Host "➜ $args" -ForegroundColor Blue }
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Verbose-Custom { if ($Verbose) { Write-Host "  $args" -ForegroundColor Cyan } }

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $Title" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
}

function Show-Usage {
    Write-Host "Usage: .\scripts\seed-testnet.ps1 [OPTIONS]" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Description:" -ForegroundColor Blue
    Write-Host "  Seeds the testnet with realistic campaign data covering all lifecycle stages:"
    Write-Host "  - Active campaigns (new, mid-progress, near goal)"
    Write-Host "  - Fully funded campaigns"
    Write-Host "  - Failed campaigns (expired, below goal)"
    Write-Host "  - Campaigns in refunding state"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Blue
    Write-Host "  -Network <string>              Network to seed (default: testnet)"
    Write-Host "  -Creator <address>             Creator Stellar address (required)"
    Write-Host "  -Token <address>               Token contract ID (required)"
    Write-Host "  -RegistryId <id>               Existing registry contract ID (optional)"
    Write-Host "  -NumCampaigns <int>            Number of campaigns to create (default: 5)"
    Write-Host "  -Verbose                       Enable verbose output"
    Write-Host "  -Help                          Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Blue
    Write-Host "  # Seed testnet with default 5 campaigns"
    Write-Host "  .\scripts\seed-testnet.ps1 ``"
    Write-Host "    -Creator GBBD47UZQ2QDAAK63XUIFH5FXVLNFSMQC4MLR4LHPWKFG7FMKGV2FI2QI ``"
    Write-Host "    -Token CAQCBGVLWCSMNRMQ4ZBVWWV5CSTW2UNKHJ42OU7CW7ADGNBORAEOSON"
    Write-Host ""
    Write-Host "  # Seed with 10 campaigns and verbose output"
    Write-Host "  .\scripts\seed-testnet.ps1 -Creator `$env:CREATOR -Token `$env:TOKEN ``"
    Write-Host "    -NumCampaigns 10 -Verbose"
}

if ($Help) {
    Show-Usage
    exit 0
}

# Validate required arguments
if (-not $Creator) {
    Write-Error "Creator address is required. Use -Creator or set CREATOR env var."
    Show-Usage
    exit 1
}

if (-not $Token) {
    Write-Error "Token contract ID is required. Use -Token or set TOKEN env var."
    Show-Usage
    exit 1
}

if ($NumCampaigns -lt 1) {
    Write-Error "Number of campaigns must be a positive integer"
    exit 1
}

# Start seeding process
Write-Section "Fund-My-Cause Testnet Seeding"
Write-Info "Network: $Network"
Write-Info "Creator: $Creator"
Write-Info "Token: $Token"
Write-Info "Campaigns to create: $NumCampaigns"

# Build contracts
Write-Section "Building Contracts"
Write-Info "Building crowdfund contract..."
$buildOutput = cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/crowdfund/Cargo.toml 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build crowdfund contract"
    exit 1
}
Write-Success "Crowdfund contract built"

Write-Info "Building registry contract..."
$buildOutput = cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/registry/Cargo.toml 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build registry contract"
    exit 1
}
Write-Success "Registry contract built"

# Deploy or use existing registry
Write-Section "Registry Setup"
if (-not $RegistryId) {
    Write-Info "Deploying registry contract..."
    $RegistryId = stellar contract deploy `
        --wasm target/wasm32-unknown-unknown/release/registry.wasm `
        --network $Network `
        --source $Creator 2>&1 | Out-String
    
    $RegistryId = $RegistryId.Trim()
    
    if ($LASTEXITCODE -ne 0 -or -not $RegistryId) {
        Write-Error "Failed to deploy registry"
        exit 1
    }
    Write-Success "Registry deployed: $RegistryId"
} else {
    Write-Info "Using existing registry: $RegistryId"
}

# Campaign templates
$campaigns = @(
    @{State="Active (New)"; Title="Save the Rainforest"; Description="Help protect endangered species and their habitats"; Goal=10000000000; Deadline=1735689600; MinContrib=1000000; CurrentTotal=0; Status="Active"; Category="Environment"},
    @{State="Active (Mid-Progress)"; Title="Clean Ocean Initiative"; Description="Remove plastic waste from our oceans"; Goal=5000000000; Deadline=1735689600; MinContrib=500000; CurrentTotal=3000000000; Status="Active"; Category="Environment"},
    @{State="Active (Near Goal)"; Title="Community Library Fund"; Description="Build a library for our local community"; Goal=2000000000; Deadline=1735689600; MinContrib=100000; CurrentTotal=1950000000; Status="Active"; Category="Education"},
    @{State="Fully Funded"; Title="Solar Panel Installation"; Description="Install solar panels on community center"; Goal=3000000000; Deadline=1704067200; MinContrib=200000; CurrentTotal=3500000000; Status="Funded"; Category="Environment"},
    @{State="Failed (Expired)"; Title="Mobile App Development"; Description="Create education app for students"; Goal=8000000000; Deadline=1672531200; MinContrib=500000; CurrentTotal=2000000000; Status="Failed"; Category="Technology"}
)

# Add more campaigns if requested
if ($NumCampaigns -gt 5) {
    $campaigns += @{State="Active (Early Stage)"; Title="Wildlife Sanctuary"; Description="Create a safe haven for rescued wildlife"; Goal=15000000000; Deadline=1767225600; MinContrib=1000000; CurrentTotal=500000000; Status="Active"; Category="Environment"}
    $campaigns += @{State="Refunding"; Title="Medical Equipment Fund"; Description="Purchase medical equipment for clinic"; Goal=4000000000; Deadline=1672531200; MinContrib=300000; CurrentTotal=1500000000; Status="Refunding"; Category="Health"}
    $campaigns += @{State="Active (Low Progress)"; Title="Art Gallery Opening"; Description="Launch contemporary art gallery"; Goal=6000000000; Deadline=1735689600; MinContrib=250000; CurrentTotal=400000000; Status="Active"; Category="Arts"}
    $campaigns += @{State="Near Deadline (Active)"; Title="Emergency Relief Fund"; Description="Provide emergency relief to disaster victims"; Goal=12000000000; Deadline=1704153600; MinContrib=500000; CurrentTotal=11000000000; Status="Active"; Category="Health"}
    $campaigns += @{State="Paused"; Title="Tech Startup Seed"; Description="Launch innovative tech startup"; Goal=20000000000; Deadline=1767225600; MinContrib=1000000; CurrentTotal=8000000000; Status="Paused"; Category="Technology"}
}

# Arrays to store results
$contractIds = @()
$campaignData = @()

# Get current timestamp for deadline calculations
$currentTime = [int][double]::Parse((Get-Date -UFormat %s))
$future30Days = $currentTime + 2592000
$future60Days = $currentTime + 5184000
$past30Days = $currentTime - 2592000
$past60Days = $currentTime - 5184000

# Deploy campaigns
Write-Section "Deploying Campaigns"

$campaignCount = [Math]::Min($NumCampaigns, $campaigns.Count)

for ($i = 0; $i -lt $campaignCount; $i++) {
    $campaign = $campaigns[$i]
    
    Write-Info "[$($i + 1)/$campaignCount] Creating campaign: $($campaign.Title) ($($campaign.State))"
    
    # Adjust deadline based on state
    $deadline = $campaign.Deadline
    switch -Wildcard ($campaign.State) {
        "*Active*" { $deadline = $future30Days }
        "*Funded*" { $deadline = $past30Days }
        "*Failed*" { $deadline = $past60Days }
        "*Refunding*" { $deadline = $past60Days }
        "*Near Deadline*" { $deadline = $currentTime + 86400 }
    }
    
    Write-Verbose-Custom "  Title: $($campaign.Title)"
    Write-Verbose-Custom "  Goal: $($campaign.Goal) stroops"
    Write-Verbose-Custom "  Deadline: $deadline"
    Write-Verbose-Custom "  Target state: $($campaign.Status)"
    
    # Deploy campaign contract
    Write-Verbose-Custom "  Deploying contract..."
    $contractId = stellar contract deploy `
        --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm `
        --network $Network `
        --source $Creator 2>&1 | Out-String
    
    $contractId = $contractId.Trim()
    
    if ($LASTEXITCODE -ne 0 -or -not $contractId) {
        Write-Error "Failed to deploy campaign contract"
        continue
    }
    
    Write-Verbose-Custom "  Contract ID: $contractId"
    
    # Initialize campaign
    Write-Verbose-Custom "  Initializing campaign..."
    $initResult = stellar contract invoke `
        --id $contractId `
        --network $Network `
        --source $Creator `
        -- initialize `
        --creator $Creator `
        --token $Token `
        --goal $($campaign.Goal) `
        --deadline $deadline `
        --min_contribution $($campaign.MinContrib) `
        --max_contribution 0 `
        --title $($campaign.Title) `
        --description $($campaign.Description) `
        --social_links null `
        --platform_config null `
        --accepted_tokens null `
        --category $($campaign.Category) `
        --vesting null `
        --penalty_bps null 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to initialize campaign: $($campaign.Title)"
        continue
    }
    
    # Register in registry
    Write-Verbose-Custom "  Registering in registry..."
    $registerResult = stellar contract invoke `
        --id $RegistryId `
        --network $Network `
        --source $Creator `
        -- register `
        --campaign_id $contractId 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to register campaign in registry (non-fatal)"
    }
    
    # Note contributions (actual contribution simulation would require multiple funded accounts)
    if ($campaign.CurrentTotal -gt 0) {
        Write-Verbose-Custom "  Target contributions: $($campaign.CurrentTotal) stroops"
    }
    
    $contractIds += $contractId
    $campaignData += @{
        Title = $campaign.Title
        ContractId = $contractId
        Status = $campaign.Status
        Goal = $campaign.Goal
        CurrentTotal = $campaign.CurrentTotal
        Deadline = $deadline
    }
    
    Write-Success "Campaign created: $($campaign.Title)"
    Write-Verbose-Custom "  Contract ID: $contractId"
}

# Save configuration
Write-Section "Saving Configuration"

$envFile = "apps/interface/.env.local"
Write-Info "Updating $envFile..."

if (Test-Path $envFile) {
    Copy-Item $envFile "$envFile.backup"
    Write-Verbose-Custom "  Backup created: $envFile.backup"
}

$envContent = @"
# Auto-generated by seed-testnet.ps1 - $(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
NEXT_PUBLIC_REGISTRY_ID=$RegistryId
NEXT_PUBLIC_NETWORK=$Network
NEXT_PUBLIC_TOKEN_ID=$Token

# Seeded Campaign IDs
"@

for ($i = 0; $i -lt $contractIds.Count; $i++) {
    $envContent += "`nNEXT_PUBLIC_CAMPAIGN_$($i)_ID=$($contractIds[$i])"
}

$envContent | Out-File -FilePath $envFile -Encoding utf8
Write-Success "Configuration saved to $envFile"

# Generate fixtures JSON
$fixturesFile = "fixtures/seed-data.json"
Write-Info "Generating fixtures file: $fixturesFile..."

New-Item -ItemType Directory -Force -Path "fixtures" | Out-Null

$fixturesData = @{
    generated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    network = $Network
    registry_id = $RegistryId
    token_id = $Token
    creator = $Creator
    campaigns = $campaignData
}

$fixturesData | ConvertTo-Json -Depth 10 | Out-File -FilePath $fixturesFile -Encoding utf8
Write-Success "Fixtures saved to $fixturesFile"

# Print summary
Write-Section "Seeding Complete"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                     SEEDING SUCCESSFUL                         ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║ Network:            $Network" -ForegroundColor Cyan
Write-Host "║ Registry ID:        $RegistryId" -ForegroundColor Cyan
Write-Host "║ Token ID:           $Token" -ForegroundColor Cyan
Write-Host "║ Campaigns Created:  $($contractIds.Count)" -ForegroundColor Cyan
Write-Host "║ Config File:        $envFile" -ForegroundColor Cyan
Write-Host "║ Fixtures File:      $fixturesFile" -ForegroundColor Cyan
Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║ Campaign States:" -ForegroundColor Blue

foreach ($data in $campaignData) {
    $percentage = 0
    if ($data.Goal -gt 0) {
        $percentage = [Math]::Round(($data.CurrentTotal / $data.Goal) * 100)
    }
    Write-Host "║   • $($data.Title) ($($data.Status) - $percentage%)" -ForegroundColor Green
}

Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Success "Ready to use! Start the frontend:"
Write-Host "  cd apps/interface && npm run dev" -ForegroundColor Blue
Write-Host ""
Write-Info "Note: To fully simulate contributions, fund additional testnet accounts"
Write-Info "and use the contribute function on deployed contracts."
