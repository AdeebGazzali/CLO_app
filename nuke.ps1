$HostUrl = "https://oejmnbesyzixxwikvzeu.supabase.co"
$ApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74"

$Headers = @{
    "apikey" = $ApiKey
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

Write-Host "Fetching User..."
$UsersUri = "$HostUrl/rest/v1/user_stats?select=user_id"
$Users = Invoke-RestMethod -Uri $UsersUri -Method GET -Headers $Headers
if (-not $Users -or $Users.Count -eq 0) { throw "User not found." }
$UserId = $Users[0].user_id

Write-Host "Fetching Ledger..."
$LedgerUri = "$HostUrl/rest/v1/wallet_history?user_id=eq.$UserId&select=*&order=date.asc,id.asc"
$AllRows = Invoke-RestMethod -Uri $LedgerUri -Method GET -Headers $Headers

$Ghosts = $AllRows | Where-Object { $_.description -match "Legacy Starting Capital" }
Write-Host "Found $($Ghosts.Count) ghost rows. Deleting..."

foreach ($Ghost in $Ghosts) {
    Write-Host "Deleting ID: $($Ghost.id) - $($Ghost.description)"
    $DelUri = "$HostUrl/rest/v1/wallet_history?id=eq.$($Ghost.id)"
    Invoke-RestMethod -Uri $DelUri -Method DELETE -Headers $Headers
}

$ValidRows = $AllRows | Where-Object { $_.description -notmatch "Legacy Starting Capital" -and $_.is_reversed -ne $true }

$GapW = 0
$GapF = 0

foreach ($R in $ValidRows) {
    $A = [Math]::Abs([decimal]$R.amount)
    $T = $R.type
    
    if ($T -in "IN", "CREDIT", "FUND_OUT", "FUND_WITHDRAWAL_IN") { $GapW += $A }
    if ($T -in "OUT", "FUND_SWEEP_OUT", "FUND_IN") { $GapW -= $A }
    if ($T -in "FUND_IN", "FUND_SWEEP_IN") { $GapF += $A }
    if ($T -in "FUND_OUT", "FUND_WITHDRAWAL_OUT") { $GapF -= $A }
}

$NeededW = 0 - $GapW
$NeededF = 78744 - $GapF

Write-Host "Gap Wallet Math: $GapW -> Needed: $NeededW"
Write-Host "Gap Fund Math: $GapF -> Needed: $NeededF"

$NewInserts = @()

if ($NeededW -ne 0) {
    $BodyW = @{ user_id = $UserId; amount = $NeededW; description = "Legacy Starting Capital (Wallet)"; date = "2024-01-01"; type = "IN" } | ConvertTo-Json
    $UriW = "$HostUrl/rest/v1/wallet_history"
    $InsW = Invoke-RestMethod -Uri $UriW -Method POST -Headers $Headers -Body $BodyW
    if ($InsW) { $NewInserts += $InsW[0] }
}

if ($NeededF -ne 0) {
    $BodyF = @{ user_id = $UserId; amount = $NeededF; description = "Legacy Starting Capital (Fund)"; date = "2024-01-01"; type = "FUND_IN" } | ConvertTo-Json
    $UriF = "$HostUrl/rest/v1/wallet_history"
    $InsF = Invoke-RestMethod -Uri $UriF -Method POST -Headers $Headers -Body $BodyF
    if ($InsF) { $NewInserts += $InsF[0] }
}

$CombinedRows = @($NewInserts) + @($ValidRows)
$CombinedRows = $CombinedRows | Sort-Object @{Expression={ [datetime]$_.date }; Ascending=$true}, @{Expression={$_.id}; Ascending=$true}

$RunW = 0
$RunF = 0

Write-Host "Chronological math recalculation..."

foreach ($R in $CombinedRows) {
    $A = [Math]::Abs([decimal]$R.amount)
    $T = $R.type
    
    if ($T -in "IN", "CREDIT") { $RunW += $A }
    elseif ($T -eq "OUT") { $RunW -= $A }
    elseif ($T -eq "FUND_OUT") { $RunF -= $A; $RunW += $A }
    elseif ($T -eq "FUND_IN") { 
        $RunF += $A
        if ($R.description -notmatch "Legacy") { $RunW -= $A }
    }
    elseif ($T -eq "FUND_SWEEP_IN") { $RunF += $A }
    elseif ($T -eq "FUND_SWEEP_OUT") { $RunW -= $A }
    elseif ($T -eq "FUND_WITHDRAWAL_OUT") { $RunF -= $A }
    elseif ($T -eq "FUND_WITHDRAWAL_IN") { $RunW += $A }

    $BodyPatch = @{ wallet_balance_snapshot = $RunW; fund_balance_snapshot = $RunF } | ConvertTo-Json
    $PatchUri = "$HostUrl/rest/v1/wallet_history?id=eq.$($R.id)"
    Invoke-RestMethod -Uri $PatchUri -Method PATCH -Headers $Headers -Body $BodyPatch | Out-Null
}

Write-Host "Stamping User Stats | Wallet: $RunW | Fund: $RunF"
$StatsBody = @{ wallet_balance = $RunW; wealth_uni_fund = $RunF } | ConvertTo-Json
$StatsUri = "$HostUrl/rest/v1/user_stats?user_id=eq.$UserId"
Invoke-RestMethod -Uri $StatsUri -Method PATCH -Headers $Headers -Body $StatsBody | Out-Null

Write-Host "HARD SYNC COMPLETE."
