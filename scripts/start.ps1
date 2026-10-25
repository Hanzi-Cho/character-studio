$ErrorActionPreference = 'Stop'
$studioRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$studioNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$studioNode = if ($studioNodeCommand) { $studioNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $studioNode)) { throw 'Node.js 24 이상을 설치한 뒤 다시 실행해 주세요.' }
$studioUrl = 'http://127.0.0.1:4317'
try { $studioStatus = Invoke-RestMethod -Uri "$studioUrl/api/state" -TimeoutSec 2 } catch { $studioStatus = $null }
if (-not $studioStatus.document) {
  if (-not $env:CHARACTER_CODEX_PATH -and $env:CHARACTER_CHAT_MODE -ne 'local') {
    $studioCodex = Get-Command codex -ErrorAction SilentlyContinue
    if (-not $studioCodex) { throw 'Codex CLI 설치와 ChatGPT 로그인이 필요합니다. 설치 후 codex login을 실행해 주세요.' }
    $env:CHARACTER_CODEX_PATH = $studioCodex.Source
  }
  if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'node_modules\tsx'))) { throw '먼저 프로젝트 폴더에서 pnpm install과 pnpm build를 실행해 주세요.' }
  if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'dist\index.html'))) {
    Push-Location $studioRoot
    try { & $studioNode scripts/build.mjs; if ($LASTEXITCODE -ne 0) { throw '빌드 실패' } } finally { Pop-Location }
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $studioRoot '.data') | Out-Null
  $studioProcess = Start-Process -FilePath $studioNode -ArgumentList @('--import','tsx','server/main.ts') -WorkingDirectory $studioRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $studioRoot '.data\server.log') -RedirectStandardError (Join-Path $studioRoot '.data\server-error.log')
  for ($studioAttempt = 0; $studioAttempt -lt 30; $studioAttempt++) {
    Start-Sleep -Milliseconds 250
    try { $studioStatus = Invoke-RestMethod -Uri "$studioUrl/api/state" -TimeoutSec 1; break } catch { if ($studioProcess.HasExited) { throw '실행 실패. .data/server-error.log를 확인해 주세요.' } }
  }
  if (-not $studioStatus.document) { throw '실행 응답을 받지 못했습니다. .data/server-error.log를 확인해 주세요.' }
  Set-Content -LiteralPath (Join-Path $studioRoot '.data\server.pid') -Value $studioProcess.Id
}
Start-Process $studioUrl -WindowStyle Hidden
