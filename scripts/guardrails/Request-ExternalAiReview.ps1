param(
    [string]$BaseRef = "origin/main",
    [string]$OutputPath = "blueprint/reviews/current-diff-review.md"
)

$ErrorActionPreference = "Stop"
$repoRoot = (& git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

if (-not $env:BLUEPRINT_AI_REVIEW_CMD) {
    throw "Set BLUEPRINT_AI_REVIEW_CMD to a command that accepts the prompt file path as its first argument and writes review markdown to stdout."
}

$mergeBase = (& git merge-base HEAD $BaseRef 2>$null)
if (-not $mergeBase) {
    $mergeBase = (& git rev-parse HEAD~1)
}

$changedFiles = (& git diff --name-only "$mergeBase...HEAD") -join "`n"
$diff = (& git diff --find-renames "$mergeBase...HEAD") -join "`n"
$overview = if (Test-Path "blueprint/context/project-overview.md") { Get-Content "blueprint/context/project-overview.md" -Raw } else { "" }
$standards = if (Test-Path "blueprint/context/coding-standards.md") { Get-Content "blueprint/context/coding-standards.md" -Raw } else { "" }
$feature = if (Test-Path "blueprint/context/current-feature.md") { Get-Content "blueprint/context/current-feature.md" -Raw } else { "" }

$prompt = @"
You are the independent reviewer for an AI-assisted coding workflow.

Review the current diff for:
- architecture drift from the project overview and coding standards
- hallucinated or misleading implementation claims
- scope creep beyond the current feature or fix
- shortcuts that a single-session implementation agent might take
- missing tests, missing verification, or unproven done-when claims
- prop drilling, oversized component surfaces, or avoidable coupling

Return markdown with exactly these sections:

## Reviewer
## Diff Scope
## Findings
## Drift Check
## Claim Check
## Verdict

Use severity labels P0, P1, P2, P3 for findings. If the diff should not merge,
say that clearly in Verdict.

# Changed files

$changedFiles

# Project overview

$overview

# Coding standards

$standards

# Current feature

$feature

# Diff

$diff
"@

$tempPrompt = New-TemporaryFile
Set-Content -Path $tempPrompt -Value $prompt -Encoding UTF8

$env:BLUEPRINT_REVIEW_PROMPT_FILE = [string]$tempPrompt
$review = Invoke-Expression "$($env:BLUEPRINT_AI_REVIEW_CMD) `"$tempPrompt`""
Remove-Item $tempPrompt -Force

if (-not $review) {
    throw "External AI review command produced no output."
}

$outFullPath = Join-Path $repoRoot $OutputPath
$outDir = Split-Path $outFullPath -Parent
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

Set-Content -Path $outFullPath -Value $review -Encoding UTF8
Write-Host "Wrote external review to $OutputPath"
