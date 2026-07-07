param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = (& git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

$hooksDir = Join-Path $repoRoot ".git/hooks"
if (-not (Test-Path $hooksDir)) {
    throw "Missing Git hooks directory: $hooksDir"
}

$templates = @{
    "pre-commit" = "scripts/guardrails/hooks/pre-commit"
    "pre-push" = "scripts/guardrails/hooks/pre-push"
}

foreach ($hookName in $templates.Keys) {
    $target = Join-Path $hooksDir $hookName
    $source = Join-Path $repoRoot $templates[$hookName]

    if ((Test-Path $target) -and -not $Force) {
        throw "Hook already exists: $target. Re-run with -Force to replace it."
    }

    Copy-Item $source $target -Force
    if ($IsLinux -or $IsMacOS) {
        & chmod +x $target
    }
    Write-Host "Installed $hookName hook."
}

Write-Host "Blueprint guardrail hooks installed."
