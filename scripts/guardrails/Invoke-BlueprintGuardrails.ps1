param(
    [ValidateSet("pre-commit", "pre-push", "ci")]
    [string]$Mode = "ci",
    [string]$BaseRef = "origin/main",
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
$repoRoot = (& git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

$configPath = Join-Path $repoRoot "blueprint/guardrails/config.json"
if (-not (Test-Path $configPath)) {
    throw "Missing guardrail config: $configPath"
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Add-Failure([string]$Message) {
    $script:failures.Add($Message) | Out-Null
}

function Add-Warning([string]$Message) {
    $script:warnings.Add($Message) | Out-Null
}

function Invoke-Git {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $output = & git @Args 2>$null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference

    if ($exitCode -ne 0) {
        return $null
    }
    return $output
}

function Get-ChangedFiles {
    if ($Mode -eq "pre-commit") {
        $files = Invoke-Git -Args @("diff", "--cached", "--name-only", "--diff-filter=ACMR")
    } else {
        $mergeBase = Invoke-Git -Args @("merge-base", "HEAD", $BaseRef)
        if (-not $mergeBase) {
            $mergeBase = Invoke-Git -Args @("rev-parse", "HEAD~1")
        }
        if ($mergeBase) {
            $files = Invoke-Git -Args @("diff", "--name-only", "--diff-filter=ACMR", "$mergeBase...HEAD")
        } else {
            $files = Invoke-Git -Args @("diff", "--name-only", "--diff-filter=ACMR", "HEAD")
        }

        $workingTreeFiles = Invoke-Git -Args @("diff", "--name-only", "--diff-filter=ACMR")
        $stagedFiles = Invoke-Git -Args @("diff", "--cached", "--name-only", "--diff-filter=ACMR")
        $untrackedFiles = Invoke-Git -Args @("ls-files", "--others", "--exclude-standard")
        $files = @($files) + @($workingTreeFiles) + @($stagedFiles) + @($untrackedFiles)
    }

    if (-not $files) {
        return @()
    }

    return @($files | Where-Object { $_ -and $_.Trim().Length -gt 0 } | ForEach-Object { $_.Replace("\", "/") } | Sort-Object -Unique)
}

function Test-PathPrefix([string]$Path, $Prefixes) {
    foreach ($prefix in $Prefixes) {
        if ($Path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Get-DiffText {
    if ($Mode -eq "pre-commit") {
        $text = Invoke-Git -Args @("diff", "--cached", "--unified=0")
    } else {
        $mergeBase = Invoke-Git -Args @("merge-base", "HEAD", $BaseRef)
        if ($mergeBase) {
            $text = Invoke-Git -Args @("diff", "--unified=0", "$mergeBase...HEAD")
        } else {
            $text = Invoke-Git -Args @("diff", "--unified=0", "HEAD~1...HEAD")
        }

        $workingTreeText = Invoke-Git -Args @("diff", "--unified=0")
        $stagedText = Invoke-Git -Args @("diff", "--cached", "--unified=0")
        $text = @($text) + @($workingTreeText) + @($stagedText)
    }

    if (-not $text) {
        return ""
    }
    return ($text -join "`n")
}

function Test-ReviewArtifact([string]$ArtifactPath) {
    if (-not (Test-Path $ArtifactPath)) {
        return $false
    }

    $review = Get-Content $ArtifactPath -Raw
    $requiredSections = @(
        "## Reviewer",
        "## Diff Scope",
        "## Findings",
        "## Drift Check",
        "## Claim Check",
        "## Verdict"
    )

    foreach ($section in $requiredSections) {
        if ($review -notmatch [regex]::Escape($section)) {
            Add-Failure "External review is missing required section: $section"
        }
    }

    if ($review -match "Pending\.") {
        Add-Failure "External review still has the placeholder verdict."
    }

    return $true
}

function Test-AgentClaims([string]$ArtifactPath, [string[]]$ChangedFiles) {
    if (-not (Test-Path $ArtifactPath)) {
        return
    }

    $claims = Get-Content $ArtifactPath -Raw
    $claimFileLines = $claims -split "`r?`n" |
        Where-Object { $_ -match "^\s*-\s+(.+)$" } |
        ForEach-Object { $Matches[1].Trim().Replace("\", "/") }

    $repoPaths = $claimFileLines | Where-Object {
        $_ -match "\.(md|ts|tsx|js|jsx|json|css|scss|py|go|rs|java|cs|yml|yaml|ps1|sh)$"
    }

    foreach ($path in $repoPaths) {
        if ($ChangedFiles -notcontains $path -and -not (Test-Path $path)) {
            Add-Failure "Agent claim references a file that is not changed and does not exist: $path"
        }
    }

    foreach ($path in $ChangedFiles) {
        if ($claims -match [regex]::Escape("no app changes") -and (Test-PathPrefix $path $config.sourcePathPrefixes)) {
            Add-Failure "Agent claims no app changes, but source file changed: $path"
        }
    }

    if ($claims -match "(?i)(build|test|lint).*(pass|passed|green)" -and $claims -notmatch "Evidence Files") {
        Add-Failure "Agent claims passing checks without an Evidence Files section."
    }
}

function Test-PropDrilling([string]$DiffText) {
    if (-not $DiffText) {
        return
    }

    $addedLines = $DiffText -split "`n" | Where-Object { $_ -match "^\+[^+]" }
    $propPattern = "\b([A-Za-z_][A-Za-z0-9_]*)=\{"
    $propCounts = @{}

    foreach ($line in $addedLines) {
        $matches = [regex]::Matches($line, $propPattern)
        foreach ($match in $matches) {
            $name = $match.Groups[1].Value
            if (-not $propCounts.ContainsKey($name)) {
                $propCounts[$name] = 0
            }
            $propCounts[$name]++
        }

        $componentProps = [regex]::Match($line, "function\s+[A-Z][A-Za-z0-9_]*\s*\(([^)]*)\)")
        if ($componentProps.Success) {
            $count = ([regex]::Matches($componentProps.Groups[1].Value, "\b[A-Za-z_][A-Za-z0-9_]*\b")).Count
            if ($count -gt [int]$config.propDrilling.maxPropsOnComponent) {
                $message = "Possible oversized component prop surface: $($componentProps.Value)"
                if ($strictReview -and $config.propDrilling.failInStrictMode) {
                    Add-Failure $message
                } else {
                    Add-Warning $message
                }
            }
        }
    }

    foreach ($key in $propCounts.Keys) {
        if ($propCounts[$key] -ge [int]$config.propDrilling.repeatedPropThreshold) {
            $message = "Possible prop drilling: prop '$key' appears in $($propCounts[$key]) added JSX bindings."
            if ($strictReview -and $config.propDrilling.failInStrictMode) {
                Add-Failure $message
            } else {
                Add-Warning $message
            }
        }
    }
}

$changedFiles = Get-ChangedFiles
$diffText = Get-DiffText
$branch = (& git branch --show-current).Trim()
$strictReview = $Strict -or ($env:BLUEPRINT_REQUIRE_EXTERNAL_AI_REVIEW -eq "1")

if ($changedFiles.Count -eq 0) {
    Write-Host "Blueprint guardrails: no changed files for mode '$Mode'."
    exit 0
}

if ($Mode -eq "pre-commit" -and $config.protectedBranches -contains $branch) {
    Add-Failure "Refusing to commit directly on protected branch '$branch'. Use a feature or fix branch."
}

$sourceChanged = $false
$workflowChanged = $false
foreach ($file in $changedFiles) {
    if (Test-PathPrefix $file $config.sourcePathPrefixes) {
        $sourceChanged = $true
    }
    if (Test-PathPrefix $file $config.workflowPathPrefixes) {
        $workflowChanged = $true
    }
}

if ($sourceChanged -and (Test-Path "blueprint/context/current-feature.md")) {
    $currentFeature = Get-Content "blueprint/context/current-feature.md" -Raw
    if ($currentFeature -match "_Nothing in progress") {
        Add-Failure "Source files changed while current-feature.md says nothing is in progress."
    }
}

if ($sourceChanged -and (Test-Path "blueprint/context/project-overview.md")) {
    $overview = Get-Content "blueprint/context/project-overview.md" -Raw
    if ($overview -match "_Not generated yet") {
        Add-Failure "Source files changed before project-overview.md was generated."
    }
}

if ($workflowChanged) {
    Add-Warning "Workflow files changed. Review adapter symmetry between .agents and .claude when applicable."
}

$reviewArtifact = Join-Path $repoRoot $config.externalReview.artifact
if ($strictReview -and ($sourceChanged -or $workflowChanged -or $Mode -eq "ci")) {
    if (-not (Test-ReviewArtifact $reviewArtifact)) {
        Add-Failure "Strict mode requires an external review artifact at $($config.externalReview.artifact)."
    }
} elseif (($sourceChanged -or $workflowChanged) -and -not (Test-Path $reviewArtifact)) {
    Add-Warning "No external diff review found at $($config.externalReview.artifact). Set BLUEPRINT_REQUIRE_EXTERNAL_AI_REVIEW=1 in CI to make this a hard gate."
}

$claimsArtifact = Join-Path $repoRoot $config.claimReport.artifact
Test-AgentClaims $claimsArtifact $changedFiles
Test-PropDrilling $diffText

Write-Host "Blueprint guardrails checked $($changedFiles.Count) changed file(s) in mode '$Mode'."
foreach ($warning in $warnings) {
    Write-Warning $warning
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Blueprint guardrails failed:"
    foreach ($failure in $failures) {
        Write-Host " - $failure"
    }
    exit 1
}

Write-Host "Blueprint guardrails passed."
