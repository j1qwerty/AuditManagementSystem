<#
.SYNOPSIS
    Builds and deploys the Audit Management System React (Vite) frontend.

.DESCRIPTION
    Builds the Vite app in ./client into ./client/dist, packages the static
    output with tar, uploads it through the configured SSH host, and syncs it
    to the nginx document root on the VPS. Any missing folders on the VPS are
    created automatically. The deployment does not restart a service or change
    nginx configuration.

    The app is frontend-only: all data lives in the browser (IndexedDB +
    localStorage) and there is no API to deploy. A clearly marked, disabled
    "Backend deployment options" block at the bottom of this file shows where
    API/backend deployment steps would go once a backend exists.

.PARAMETER SkipBuild
    Deploy the existing client/dist directory without running the build.

.PARAMETER SkipConfirm
    Deploy without the interactive y/N confirmation.

.PARAMETER SkipVerify
    Skip the public HTTP checks after deployment.

.PARAMETER DeployBackend
    Reserved for the future backend deployment. Disabled for now: the app is
    frontend-only, so this switch stops the script with an explanation.

.PARAMETER Host_
    SSH host alias. Defaults to "contabo".

.PARAMETER PublicUrl
    Public URL the site is served from. Defaults to "https://auditms.in".

.PARAMETER RemoteRoot
    nginx document root on the VPS. Defaults to "/var/www/auditms.in/html".

.EXAMPLE
    .\deploy-frontend.ps1
    .\deploy-frontend.ps1 -SkipConfirm
    .\deploy-frontend.ps1 -SkipBuild -SkipConfirm
    .\deploy-frontend.ps1 -PublicUrl https://ams.example.com -RemoteRoot /var/www/ams.example.com/html
#>
[CmdletBinding()]
param(
    [switch] $SkipBuild,
    [switch] $SkipConfirm,
    [switch] $SkipVerify,
    [switch] $DeployBackend,
    [string] $Host_ = 'contabo',
    [string] $PublicUrl = 'https://auditms.in',
    [string] $RemoteRoot = '/var/www/auditms.in/html'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = $PSScriptRoot
$ClientDir = Join-Path $RepoRoot 'client'
$DistDir = Join-Path $ClientDir 'dist'
$Archive = Join-Path ([System.IO.Path]::GetTempPath()) ("ams-web-" + [guid]::NewGuid().ToString('N') + '.tar.gz')
$RemoteArchive = '/tmp/ams-web-deploy.tar.gz'
$SiteName = 'Audit Management System'

$script:StepNo = 0
$script:Start = Get-Date

function Write-Step {
    param([string] $Text)
    $script:StepNo++
    $elapsed = ((Get-Date) - $script:Start).TotalSeconds
    Write-Host ''
    Write-Host ("  [{0,2}] " -f $script:StepNo) -ForegroundColor DarkGray -NoNewline
    Write-Host $Text -ForegroundColor Cyan -NoNewline
    Write-Host ("  ({0,6:N1}s)" -f $elapsed) -ForegroundColor DarkGray
}

function Write-Ok { param([string] $Text) Write-Host "       OK   $Text" -ForegroundColor Green }
function Write-Info { param([string] $Text) Write-Host "       INFO $Text" -ForegroundColor Gray }
function Fail {
    param([string] $Text)
    Write-Host "  FAIL  $Text" -ForegroundColor Red
    throw $Text
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string] $FilePath,
        [Parameter(Mandatory)] [string[]] $Arguments,
        [Parameter(Mandatory)] [string] $What,
        [string] $WorkingDirectory
    )

    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($WorkingDirectory) {
            Push-Location $WorkingDirectory
            try { $output = & $FilePath @Arguments 2>&1 }
            finally { Pop-Location }
        } else {
            $output = & $FilePath @Arguments 2>&1
        }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousEap
    }

    if ($output) { $output | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray } }
    if ($code -ne 0) { Fail "$What failed (exit $code)" }
    return ($output | Out-String)
}

function Test-CommandExists { param([string] $Name) return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

function Invoke-RemoteProbe {
    # Runs a remote command and returns its output + exit code without throwing,
    # so post-deploy HTTP checks can warn instead of aborting.
    param([Parameter(Mandatory)] [string] $Command)
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = ssh -o BatchMode=yes -o ConnectTimeout=10 $Host_ $Command 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousEap
    }
    return [pscustomobject]@{
        Output = (($output | Out-String).Trim())
        Code   = $code
    }
}

try {
    Write-Host ''
    Write-Host "  $SiteName - frontend deploy" -ForegroundColor Cyan
    Write-Host '  ---------------------------------' -ForegroundColor DarkCyan

    if ($DeployBackend) {
        Fail 'Backend deployment is disabled: this app is frontend-only. See the "Backend deployment options" block at the bottom of this script.'
    }

    Write-Step 'Preflight'
    $PackageManager = $null
    foreach ($candidate in @('pnpm', 'npm')) {
        if (Test-CommandExists $candidate) { $PackageManager = $candidate; break }
    }
    if (-not $PackageManager) { Fail 'Neither pnpm nor npm is on PATH' }
    foreach ($command in @('tar', 'ssh', 'scp')) {
        if (-not (Test-CommandExists $command)) { Fail "Required tool not on PATH: $command" }
    }
    if (-not (Test-Path $ClientDir)) { Fail "client/ folder not found next to this script ($ClientDir)" }
    foreach ($file in @('package.json', 'vite.config.js')) {
        if (-not (Test-Path (Join-Path $ClientDir $file))) { Fail "client/$file not found - run this from the repo root" }
    }
    Write-Ok "$PackageManager, tar, ssh, and scp are available; client/ project identified"

    Invoke-Checked ssh @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', $Host_, 'echo ssh-ok') `
        -What "ssh $Host_" | Out-Null
    Write-Ok "$Host_ is reachable over SSH"

    Write-Step 'Ensure remote folders'
    Invoke-Checked ssh @('-o', 'BatchMode=yes', $Host_, "mkdir -p '$RemoteRoot' && test -d '$RemoteRoot' && echo folders-ok") `
        -What "remote mkdir $RemoteRoot" | Out-Null
    Write-Ok "ensured $RemoteRoot exists on $Host_"

    $nginxProbe = Invoke-RemoteProbe "if command -v nginx >/dev/null 2>&1 && nginx -T 2>/dev/null | grep -Fq 'root $RemoteRoot;'; then echo nginx-ok; else echo nginx-not-configured; fi"
    if ($nginxProbe.Output -match 'nginx-ok') {
        Write-Ok "nginx already maps a site to $RemoteRoot"
    } else {
        Write-Info "nginx does not map $RemoteRoot yet - files will still be deployed; add a server block for $PublicUrl when ready"
    }

    if (-not $SkipBuild) {
        Write-Step 'Build React app'
        Invoke-Checked $PackageManager @('run', 'build') -What "$PackageManager run build" -WorkingDirectory $ClientDir | Out-Null
    } else {
        Write-Step 'Use existing build'
    }

    $indexPath = Join-Path $DistDir 'index.html'
    if (-not (Test-Path $indexPath)) { Fail "Build output missing: $indexPath" }
    $indexHtml = Get-Content -LiteralPath $indexPath -Raw
    $assetRefs = [regex]::Matches($indexHtml, '(?:src|href)="((?:\.?/)[^"?#]+)"') |
        ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
    if (-not $assetRefs) { Fail 'dist/index.html has no local JS/CSS references' }
    $missing = @()
    foreach ($assetRef in $assetRefs) {
        $relative = $assetRef -replace '^\.?/', ''
        $assetPath = Join-Path $DistDir ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path $assetPath)) { $missing += $assetRef }
    }
    if ($missing) { Fail ("Referenced build asset(s) are missing: " + ($missing -join ', ')) }
    Write-Ok ("dist/ contains index.html and {0} referenced file(s)" -f $assetRefs.Count)

    Write-Step 'Package static site'
    if (Test-Path $Archive) { Remove-Item -LiteralPath $Archive -Force }
    Invoke-Checked tar @('-czf', $Archive, '-C', $DistDir, '.') -What 'tar dist' | Out-Null
    Write-Ok ("created {0:N2} MB archive" -f ((Get-Item -LiteralPath $Archive).Length / 1MB))

    if (-not $SkipConfirm) {
        Write-Host ''
        Write-Host "       Deploy this build to $PublicUrl ?" -ForegroundColor White
        Write-Host "         Local build: $DistDir" -ForegroundColor Gray
        Write-Host "         Remote root: $RemoteRoot (on $Host_)" -ForegroundColor Gray
        $answer = Read-Host '       Continue [y/N]'
        if ($answer.Trim() -notin @('y', 'Y', 'yes', 'YES', 'Yes')) {
            Write-Info 'deployment cancelled'
            return
        }
    }

    Write-Step 'Upload archive'
    Invoke-Checked scp @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', $Archive, "${Host_}:$RemoteArchive") `
        -What 'scp website archive' | Out-Null
    Write-Ok 'archive uploaded to the VPS'

    Write-Step 'Deploy to nginx document root'
    $remoteScript = @'
set -eu
archive=__ARCHIVE__
root=__ROOT__
stage=$(mktemp -d /tmp/ams-web-stage.XXXXXX)
trap 'rm -rf "$stage"; rm -f "$archive"' EXIT
tar -xzf "$archive" -C "$stage"
test -s "$stage/index.html"
mkdir -p "$root"
rsync -a --delete --chown=www-data:www-data "$stage/" "$root/"
chown www-data:www-data "$root" 2>/dev/null || true
test -s "$root/index.html"
echo 'static site synced'
'@
    $remoteScript = $remoteScript.Replace('__ARCHIVE__', $RemoteArchive).Replace('__ROOT__', $RemoteRoot)
    # Send the script as stdin so its shell quoting and multiline body stay intact.
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $remoteScript | ssh -o BatchMode=yes $Host_ 'bash -s'
        $deployCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousEap
    }
    if ($deployCode -ne 0) { Fail "remote static-site deploy failed (exit $deployCode)" }
    Write-Ok "synced static build to $RemoteRoot (www-data:www-data)"

    $verifyFailures = 0
    if (-not $SkipVerify) {
        Write-Step 'Verify public site'
        $homeProbe = Invoke-RemoteProbe "curl -fsS -o /dev/null -w '%{http_code}' '$PublicUrl/'"
        if ($homeProbe.Code -eq 0 -and $homeProbe.Output -eq '200') {
            Write-Ok "$PublicUrl/ returns HTTP 200"
        } else {
            $verifyFailures++
            Write-Info "homepage check failed (exit $($homeProbe.Code), response '$($homeProbe.Output)')"
        }
        foreach ($assetRef in $assetRefs) {
            $relative = $assetRef -replace '^\.?/', ''
            $assetProbe = Invoke-RemoteProbe "curl -fsS -o /dev/null -w '%{http_code}' '$PublicUrl/$relative'"
            if ($assetProbe.Code -eq 0 -and $assetProbe.Output -eq '200') {
                Write-Ok "asset $relative returns HTTP 200"
            } else {
                $verifyFailures++
                Write-Info "asset $relative check failed (exit $($assetProbe.Code), response '$($assetProbe.Output)')"
            }
        }
        if ($verifyFailures -eq 0) { Write-Ok 'all public checks passed' }
    }

    Write-Host ''
    Write-Host '  Deploy succeeded.' -ForegroundColor Green
    Write-Host "   Access URL   $PublicUrl" -ForegroundColor White
    Write-Host "   Web root     ${Host_}:$RemoteRoot" -ForegroundColor Gray
    if ($verifyFailures -gt 0) {
        Write-Host ''
        Write-Host '  NOTE: files are deployed, but the public URL did not respond as expected.' -ForegroundColor Yellow
        Write-Host "        Point nginx at $RemoteRoot for $PublicUrl, then re-run with -SkipBuild -SkipConfirm." -ForegroundColor Yellow
    }
} finally {
    if (Test-Path $Archive) { Remove-Item -LiteralPath $Archive -Force -ErrorAction SilentlyContinue }
}

# ===========================================================================
#  Backend deployment options - DISABLED (frontend-only app for now)
# ===========================================================================
# The app currently has no backend: all data lives in the browser (IndexedDB +
# localStorage), so there is nothing to deploy besides client/dist. When a
# backend is added, enable ONE of the options below and wire it into the flow
# (a -DeployBackend switch is already reserved in param() above).
#
# Option A - Node/Express API on the same VPS
#   $BackendDir     = Join-Path $RepoRoot 'server'
#   $BackendRoot    = '/var/www/auditms.in/api'
#   $BackendService = 'ams-api'
#   Steps:
#     1. tar the server/ folder and scp it to the VPS (like the frontend archive)
#     2. ssh: mkdir -p $BackendRoot; tar -xzf the archive into it
#     3. ssh: npm ci --omit=dev --prefix $BackendRoot
#     4. ssh: systemctl restart $BackendService
#
# Option B - API behind the same nginx (reverse proxy)
#   Add to the site's server block:
#     location /api/ { proxy_pass http://127.0.0.1:3000/; }
#   Then the frontend can call /api/... on the same origin.
#
# Option C - Docker Compose stack
#   ssh: cd /opt/ams && docker compose -f docker-compose.prod.yml up -d --build
#
# None of the above runs while the app is client-side only.
