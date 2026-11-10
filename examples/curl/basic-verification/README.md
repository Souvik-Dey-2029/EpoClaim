# EpoClaim cURL Verification Examples

This folder contains runnable cURL examples demonstrating direct HTTP access to the EpoClaim REST API v1.

## Quick Run

### Linux / macOS / Git Bash
```bash
chmod +x verify.sh
./verify.sh
```

### Windows PowerShell
```powershell
$BaseUrl = "http://localhost:8000"

# 1. Health Check
Invoke-RestMethod -Uri "$BaseUrl/api/v1/health" -Method Get | ConvertTo-Json

# 2. Analyze AI-Generated Answer
$Payload = @{
    prompt = "Who is the CEO of OpenAI?"
    response_text = "OpenAI is based in San Francisco, and its interim CEO is Mira Murati."
    context_documents = @(
        "OpenAI is an AI research organization headquartered in San Francisco. Mira Murati was named interim CEO on November 17, 2023. On November 29, 2023, Sam Altman officially returned as CEO of OpenAI."
    )
    enable_live_search = $false
} | ConvertTo-Json

$Report = Invoke-RestMethod -Uri "$BaseUrl/api/v1/analyze" -Method Post -Body $Payload -ContentType "application/json"
Write-Host "Report ID:" $Report.report_id
Write-Host "Assessment:" $Report.overall_assessment
Write-Host "Supported Claims:" $Report.supported_claims
Write-Host "Outdated Claims:" $Report.outdated_claims

# 3. Retrieve Report by ID
$Fetched = Invoke-RestMethod -Uri "$BaseUrl/api/v1/analysis/$($Report.report_id)" -Method Get
Write-Host "Fetched Report ID:" $Fetched.report_id
```

