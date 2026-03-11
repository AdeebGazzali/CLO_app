$Headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74"
}
$Url = "https://oejmnbesyzixxwikvzeu.supabase.co/rest/v1/wallet_history?select=*&order=date.asc,id.asc"
$Response = Invoke-RestMethod -Uri $Url -Headers $Headers -Method Get

$lw = 0
$lf = 0
$r_sum = 0
$f_sum = 0
$count = 0

foreach ($r in $Response) {
    if ($r.description -match "Legacy Starting Capital \(Wallet\)") {
        $count++
        $lw += [math]::Round([decimal]$r.amount, 2)
        Write-Host "Legacy W: $($r.amount)"
        continue
    }
    if ($r.description -match "Legacy Starting Capital \(Fund\)") {
        $lf += [math]::Round([decimal]$r.amount, 2)
        Write-Host "Legacy F: $($r.amount)"
        continue
    }

    $a = [math]::Abs([decimal]$r.amount)
    $t = $r.type

    if ($t -eq "IN" -or $t -eq "FUND_OUT" -or $t -eq "FUND_WITHDRAWAL_IN") {
        $r_sum += $a
    }
    elseif ($t -eq "OUT" -or $t -eq "FUND_SWEEP_OUT" -or $t -eq "FUND_IN") {
        $r_sum -= $a
    }

    if ($t -eq "FUND_IN" -or $t -eq "FUND_SWEEP_IN") {
        $f_sum += $a
    }
    elseif ($t -eq "FUND_OUT" -or $t -eq "FUND_WITHDRAWAL_OUT") {
        $f_sum -= $a
    }
}

Write-Host "Count of Legacy IN: $count"
Write-Host "Legacy W injected: $lw"
Write-Host "Legacy F injected: $lf"
Write-Host "Raw Math W calculated: $r_sum"
Write-Host "Raw Math F calculated: $f_sum"
Write-Host "Final Theoretical W = $($lw + $r_sum)"
Write-Host "Final Theoretical F = $($lf + $f_sum)"
