# 결혼 준비 앱: GitHub에서 최종본을 받아 이 폴더의 app\index.html로 저장하고 브라우저로 열어요.
# 최종본 = PR #5가 검토 중(열림)이면 그 작업 브랜치, 반영되거나 닫히면 main.
# Windows PowerShell 5.1에서도 돌도록 새 문법(??, 삼항 연산자 등)은 쓰지 않아요.
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$Repo = 'dudwlstjr3-maker/marry-me'
$Pr = 5
$WorkBranch = 'claude/eager-pasteur-qydyfn'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $Here 'app'
$Target = Join-Path $AppDir 'index.html'
$Tmp = Join-Path $AppDir 'index.download.html'
$Headers = @{ 'User-Agent' = 'marry-me-start' }
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null

Write-Host '결혼 준비 앱 최종본을 GitHub에서 확인하는 중이에요...'
$refs = @()
try {
  $pull = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/pulls/$Pr" -Headers $Headers -TimeoutSec 20
  if ($pull.state -eq 'open') {
    $refs += $pull.head.ref
    Write-Host "PR #$Pr 검토 중이라 작업본($($pull.head.ref))을 받아요."
  } else {
    Write-Host "PR #$Pr 반영이 끝나 main을 받아요."
  }
} catch {
  $refs += $WorkBranch
  Write-Host 'PR 상태를 확인하지 못해 작업본부터 받아 볼게요.'
}
$refs += 'main'

$got = $null
foreach ($ref in $refs) {
  $stampQuery = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $url = "https://raw.githubusercontent.com/$Repo/$ref/index.html?t=$stampQuery"
  try {
    Invoke-WebRequest -Uri $url -Headers $Headers -OutFile $Tmp -UseBasicParsing -TimeoutSec 60
    $text = [IO.File]::ReadAllText($Tmp, [Text.Encoding]::UTF8)
    if ($text.Length -lt 10000 -or $text.IndexOf('id="panel-budget"') -lt 0) { throw '결혼 준비 앱 파일이 아니에요.' }
    if (Test-Path $Target) { Copy-Item $Target (Join-Path $AppDir 'index.prev.html') -Force }
    Move-Item $Tmp $Target -Force
    $got = $ref
    break
  } catch {
    if (Test-Path $Tmp) { Remove-Item $Tmp -Force }
    Write-Host "  $ref 에서 받지 못했어요: $($_.Exception.Message)"
  }
}

if ($got) {
  $when = Get-Date -Format 'yyyy-MM-dd HH:mm'
  Set-Content -Path (Join-Path $AppDir 'version.txt') -Value ("받은 곳: $Repo / $got`r`n받은 시각: $when") -Encoding UTF8
  Write-Host "최신본을 받았어요 ($got, $when)."
} elseif (Test-Path $Target) {
  Write-Host '최신본을 받지 못해 전에 받아 둔 앱을 열어요. 인터넷 연결을 확인해 주세요.'
} else {
  Write-Host '앱을 받지 못했어요. 인터넷 연결을 확인하고 start.bat을 다시 실행해 주세요.'
  exit 1
}

if (-not $env:MARRYME_NO_OPEN) { Start-Process $Target }
Start-Sleep -Seconds 2
