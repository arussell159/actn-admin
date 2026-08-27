$ErrorActionPreference = "Stop"

$envFile = Join-Path (Get-Location) ".env.local"
$envs = @{}

Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*([^#=]+)=(.*)$") {
    $envs[$matches[1].Trim()] = $matches[2].Trim()
  }
}

$url = $envs["NEXT_PUBLIC_SUPABASE_URL"]
$key = $envs["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
$headers = @{
  apikey = $key
  Authorization = "Bearer $key"
}
$tables = @(
  "month_end_records",
  "month_end_templates",
  "information_notes",
  "quote_items",
  "quote_records",
  "app_settings"
)

foreach ($table in $tables) {
  try {
    $uri = "$url/rest/v1/$table`?select=*&limit=1"
    $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $uri -Headers $headers

    [pscustomobject]@{
      Table = $table
      Ok = $true
      Status = [int]$response.StatusCode
      Error = ""
    }
  } catch {
    [pscustomobject]@{
      Table = $table
      Ok = $false
      Status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
      Error = $_.ErrorDetails.Message
    }
  }
}
