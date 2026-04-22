<#
.SYNOPSIS
  Smoke-test the Synthed REST API (assumes server is already running).

.PARAMETER BaseUrl
  API root, e.g. http://localhost:3000

.EXAMPLE
  .\scripts\api-smoke.ps1
.EXAMPLE
  .\scripts\api-smoke.ps1 -BaseUrl http://127.0.0.1:3000
#>
param(
  [uri]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$root = $BaseUrl.ToString().TrimEnd("/")

function Write-Step($msg) { Write-Host "`n== $msg ==" -ForegroundColor Cyan }

try {
  Write-Step "GET /api/v1/generators"
  $list = Invoke-RestMethod -Uri "$root/api/v1/generators" -Method Get
  if (-not @($list).Count) { throw "Expected non-empty generator list" }
  Write-Host ("OK: {0} generator(s)" -f @($list).Count)

  $sampleId = $list[0].id
  Write-Step "GET /api/v1/generators/$sampleId"
  $desc = Invoke-RestMethod -Uri "$root/api/v1/generators/$sampleId" -Method Get
  if ($desc.id -ne $sampleId) { throw "Describe response id mismatch" }
  Write-Host "OK: describe id=$($desc.id)"

  Write-Step "POST /api/v1/generate (JSON in, octet-stream out)"
  $genBody = @{
    generator = "hl7v2"
    options   = @{ seed = 1; recordCount = 2 }
  } | ConvertTo-Json -Depth 5 -Compress
  $tmpOut = Join-Path ([System.IO.Path]::GetTempPath()) ("synthed-smoke-{0}.bin" -f [Guid]::NewGuid().ToString("n"))
  try {
    Invoke-WebRequest -Uri "$root/api/v1/generate" -Method Post `
      -ContentType "application/json; charset=utf-8" -Body $genBody `
      -OutFile $tmpOut -UseBasicParsing | Out-Null
    $bytes = (Get-Item $tmpOut).Length
    if ($bytes -lt 1) { throw "Generate output file is empty" }
    Write-Host ("OK: wrote {0} byte(s) to {1}" -f $bytes, $tmpOut)
  }
  finally { if (Test-Path $tmpOut) { Remove-Item $tmpOut -Force } }

  Write-Step "POST /api/v1/validate/hl7v2 (text/plain body)"
  $hl7Lines = @(
    "MSH|^~\&|A|B|C|D|20260315093000||ADT^A01^ADT_A01|1|P|2.5.1"
    "PID|1||123^^^HOSP^MR||DOE^JANE||19700101|F"
    "PV1|1|I"
  )
  $hl7 = $hl7Lines -join "`r`n"
  $report = Invoke-RestMethod -Uri "$root/api/v1/validate/hl7v2" -Method Post `
    -ContentType "text/plain; charset=utf-8" -Body $hl7
  if ($report.generatorId -ne "hl7v2") { throw "Validation report generatorId unexpected" }
  Write-Host ("OK: validation passed={0}, errors={1}" -f $report.passed, @($report.errors).Count)

  Write-Step "POST /api/v1/selftest/fix"
  # Fastify rejects POST with no/unknown Content-Type; empty JSON is fine.
  $self = Invoke-RestMethod -Uri "$root/api/v1/selftest/fix" -Method Post `
    -ContentType "application/json; charset=utf-8" -Body "{}"
  if ($self.generatorId -ne "fix") { throw "Selftest generatorId unexpected" }
  Write-Host ("OK: selftest passed={0}" -f $self.passed)

  Write-Host "`nAll API smoke checks passed." -ForegroundColor Green
  exit 0
}
catch {
  Write-Host "`nFAILED: $_" -ForegroundColor Red
  if ($_.Exception.Response) {
    try {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      Write-Host $reader.ReadToEnd() -ForegroundColor DarkRed
      $reader.Close()
    }
    catch { }
  }
  exit 1
}
