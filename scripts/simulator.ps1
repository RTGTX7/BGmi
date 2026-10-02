param(
  [ValidateSet('up', 'down', 'logs', 'status', 'seed', 'reset')]
  [string]$Action = 'up'
)

$ErrorActionPreference = 'Stop'
$compose = @('-f', 'docker-compose.simulator.yml')
$port = if ($env:BGMI_SIMULATOR_PORT) { $env:BGMI_SIMULATOR_PORT } else { '8898' }
$baseUrl = "http://127.0.0.1:$port"
$token = if ($env:BGMI_SIMULATOR_TOKEN) { $env:BGMI_SIMULATOR_TOKEN } else { 'simulator-token' }

switch ($Action) {
  'up' { docker compose @compose up -d --build }
  'down' { docker compose @compose down }
  'logs' { docker compose @compose logs -f bgmi-simulator }
  'status' { Invoke-RestMethod "$baseUrl/api/debug/status" }
  'seed' { Invoke-RestMethod -Method Post -Uri "$baseUrl/api/debug/seed" -Headers @{ 'bgmi-token' = $token } }
  'reset' { Invoke-RestMethod -Method Post -Uri "$baseUrl/api/debug/reset" -Headers @{ 'bgmi-token' = $token } }
}
