#requires -Version 5.1

<#
.SYNOPSIS
Prepares one or more SiteScape scan parts reproducibly for the Potree web viewer.

.DESCRIPTION
The script uses Python 3.12 from the system-wide Python installation and installs
missing pinned packages once for the current Windows user account. It does not
create a virtual Python environment.

A colored E57 or SiteScape PLY file is first converted to LAZ and then to COPC.
Multiple pose-free E57 parts can be written to exactly one LAZ/COPC file without
registration, downsampling, or deduplication. Both conversion steps are checked.
The results are placed in source/, viewer/data/, and qa/ only after successful
validation.

.PARAMETER InputFile
Path to an E57 or binary SiteScape PLY file. For a split scan, pass multiple E57
paths as an array.

.PARAMETER Name
Human-readable scan name, for example "SPZ Squash".

.PARAMETER Slug
File-safe lowercase identifier, for example "spz-squash". If omitted, it is
generated from Name.

.PARAMETER PlyUp
Up axis of the PLY input. SiteScape normally uses Y; this setting does not affect
E57 input.

.PARAMETER AssumeCommonCoordinates
Explicitly acknowledges for multiple E57 files that a preceding header/geometry
check established a common coordinate system. The script itself does not perform
registration or ICP alignment.

.PARAMETER Force
Replaces existing result files for the same slug. Other scans and files are not
modified.

.EXAMPLE
.\scripts\build_scan.ps1 -InputFile "C:\Scans\SPZ Squash.e57" `
  -Name "SPZ Squash" -Slug "spz-squash"

.EXAMPLE
.\scripts\build_scan.ps1 -InputFile "C:\Scans\SPZ Squash.ply" `
  -Name "SPZ Squash" -PlyUp y

.EXAMPLE
.\scripts\build_scan.ps1 -InputFile @( `
  "C:\Scans\SPZ Lueftung_1.e57", `
  "C:\Scans\SPZ Lueftung_2.e57" `
) -Name "Sports Center - Ventilation" -Slug "spz-lueftung" `
  -AssumeCommonCoordinates
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string[]]$InputFile,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Name,

    [Parameter()]
    [string]$Slug,

    [Parameter()]
    [ValidateSet("y", "z")]
    [string]$PlyUp = "y",

    [Parameter()]
    [switch]$AssumeCommonCoordinates,

    [Parameter()]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$CopcVersion = "0.9.15"
$CopcArchiveName = "copc_converter-v$CopcVersion-x86_64-pc-windows-msvc.zip"
$CopcDownloadUrl = "https://github.com/360-geo/copc-converter/releases/download/v$CopcVersion/$CopcArchiveName"
$CopcArchiveSha256 = "42341c81d1b1498149925a3bef4a597d1a61608c3bcabd4bd3a28aea30e5261f"

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Text)
    Write-Host "`n==> $Text" -ForegroundColor Cyan
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Description
    )

    $previousErrorAction = $ErrorActionPreference
    $exitCode = $null
    try {
        # Windows PowerShell 5.1 may otherwise treat text on stderr as a
        # terminating NativeCommandError even when the process succeeds.
        $ErrorActionPreference = "Continue"
        & $Executable @Arguments
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($null -eq $exitCode -or $exitCode -ne 0) {
        throw "$Description failed with exit code $exitCode."
    }
}

function Invoke-ProbeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "SilentlyContinue"
        & $Executable @Arguments
        return $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
}

function ConvertTo-Slug {
    param([Parameter(Mandatory = $true)][string]$Value)

    $lowercase = $Value.Trim().ToLowerInvariant().Replace(([char]0x00DF).ToString(), "ss")
    $normalized = $lowercase.Normalize(
        [Text.NormalizationForm]::FormD
    )
    $builder = New-Object Text.StringBuilder
    foreach ($character in $normalized.ToCharArray()) {
        $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($character)
        if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($character)
        }
    }
    $asciiLike = $builder.ToString().Normalize([Text.NormalizationForm]::FormC)
    $result = $asciiLike -replace '[^a-z0-9]+', '-'
    return $result.Trim('-')
}

function Resolve-PythonLauncher {
    $pyLauncher = Get-Command "py.exe" -ErrorAction SilentlyContinue
    if ($null -ne $pyLauncher) {
        return [PSCustomObject]@{
            Executable = $pyLauncher.Source
            PrefixArguments = @("-3.12")
        }
    }

    throw "The Windows Python launcher 'py.exe' was not found. Install Python 3.12 (64-bit), including the launcher, from https://www.python.org/downloads/windows/."
}

function Get-CopcConverter {
    param(
        [Parameter(Mandatory = $true)][string]$ToolsDirectory,
        [Parameter(Mandatory = $true)][string]$CacheDirectory
    )

    if (-not [Environment]::Is64BitOperatingSystem) {
        throw "The provided COPC converter requires 64-bit Windows."
    }

    $installDirectory = Join-Path $ToolsDirectory "copc-converter-$CopcVersion"
    $converter = Join-Path $installDirectory "copc_converter.exe"
    if (Test-Path -LiteralPath $converter -PathType Leaf) {
        Unblock-File -LiteralPath $converter -ErrorAction SilentlyContinue
        $versionOutput = (& $converter --version 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch [regex]::Escape($CopcVersion)) {
            throw "The existing COPC converter is not version $CopcVersion`: $versionOutput"
        }
        return $converter
    }

    New-Item -ItemType Directory -Path $ToolsDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $CacheDirectory -Force | Out-Null
    $archive = Join-Path $CacheDirectory $CopcArchiveName

    $archiveIsValid = $false
    if (Test-Path -LiteralPath $archive -PathType Leaf) {
        $existingHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        $archiveIsValid = $existingHash -eq $CopcArchiveSha256
        if (-not $archiveIsValid) {
            Write-Warning "The existing download has an incorrect SHA-256 checksum and will be downloaded again."
            Remove-Item -LiteralPath $archive -Force
        }
    }

    if (-not $archiveIsValid) {
        Write-Step "Download COPC converter $CopcVersion"
        $partialArchive = "$archive.partial.$([Guid]::NewGuid().ToString('N'))"
        try {
            # TLS 1.2 is required for older Windows PowerShell installations.
            [Net.ServicePointManager]::SecurityProtocol =
                [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $CopcDownloadUrl -OutFile $partialArchive -UseBasicParsing | Out-Null
            $downloadHash = (Get-FileHash -LiteralPath $partialArchive -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($downloadHash -ne $CopcArchiveSha256) {
                throw "SHA-256 verification failed. Expected: $CopcArchiveSha256; received: $downloadHash"
            }
            Move-Item -LiteralPath $partialArchive -Destination $archive
        }
        finally {
            if (Test-Path -LiteralPath $partialArchive -PathType Leaf) {
                Remove-Item -LiteralPath $partialArchive -Force
            }
        }
    }

    $extractDirectory = Join-Path $CacheDirectory "extract-$([Guid]::NewGuid().ToString('N'))"
    try {
        New-Item -ItemType Directory -Path $extractDirectory | Out-Null
        Expand-Archive -LiteralPath $archive -DestinationPath $extractDirectory
        $candidate = Get-ChildItem -LiteralPath $extractDirectory -Filter "copc_converter.exe" -File -Recurse |
            Select-Object -First 1
        if ($null -eq $candidate) {
            throw "The verified ZIP archive does not contain copc_converter.exe."
        }

        New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
        Copy-Item -LiteralPath $candidate.FullName -Destination $converter
        Unblock-File -LiteralPath $converter -ErrorAction SilentlyContinue
    }
    finally {
        if (Test-Path -LiteralPath $extractDirectory -PathType Container) {
            Remove-Item -LiteralPath $extractDirectory -Recurse -Force
        }
    }

    $installedVersion = (& $converter --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $installedVersion -notmatch [regex]::Escape($CopcVersion)) {
        throw "The installed COPC converter does not report version $CopcVersion`: $installedVersion"
    }
    return $converter
}

$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$PrepareScript = Join-Path $PSScriptRoot "prepare_pointcloud.py"
$Requirements = Join-Path $PSScriptRoot "requirements.txt"

if (-not (Test-Path -LiteralPath $PrepareScript -PathType Leaf)) {
    throw "Helper script is missing: $PrepareScript"
}
if (-not (Test-Path -LiteralPath $Requirements -PathType Leaf)) {
    throw "Python requirements file is missing: $Requirements"
}

$ResolvedInputs = @()
$SeenInputs = @{}
foreach ($inputPath in @($InputFile)) {
    try {
        $resolvedPath = (Resolve-Path -LiteralPath $inputPath -ErrorAction Stop).Path
    }
    catch {
        throw "Input file not found: $inputPath"
    }
    if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
        throw "The input is not a file: $resolvedPath"
    }
    $inputKey = $resolvedPath.ToLowerInvariant()
    if ($SeenInputs.ContainsKey($inputKey)) {
        throw "The same input file was specified more than once: $resolvedPath"
    }
    $SeenInputs[$inputKey] = $true
    $ResolvedInputs += $resolvedPath
}
if ($ResolvedInputs.Count -eq 0) {
    throw "At least one input file is required."
}

$InputExtensions = @($ResolvedInputs | ForEach-Object {
    [IO.Path]::GetExtension($_).ToLowerInvariant()
})
foreach ($inputExtension in $InputExtensions) {
    if ($inputExtension -notin @(".e57", ".ply")) {
        throw "Unsupported format '$inputExtension'. Allowed formats are .e57 and .ply."
    }
}
$IsMultipart = $ResolvedInputs.Count -gt 1
if ($IsMultipart) {
    if (@($InputExtensions | Where-Object { $_ -ne ".e57" }).Count -gt 0) {
        throw "Multipart scans are currently supported only as E57 files."
    }
    if (-not $AssumeCommonCoordinates) {
        throw "Multiple E57 files are combined only with -AssumeCommonCoordinates. Check their headers and geometric overlap first."
    }
}
$InputExtension = $InputExtensions[0]

if ([string]::IsNullOrWhiteSpace($Slug)) {
    $Slug = ConvertTo-Slug -Value $Name
}
else {
    $Slug = $Slug.Trim().ToLowerInvariant()
}
if ([string]::IsNullOrWhiteSpace($Slug) -or $Slug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "Invalid slug '$Slug'. Allowed characters are a-z, 0-9, and single hyphens, for example 'spz-squash'."
}

$SourceDirectory = Join-Path $ProjectRoot "source"
$ViewerDataDirectory = Join-Path $ProjectRoot "viewer\data"
$QaDirectory = Join-Path $ProjectRoot "qa"
$ToolsDirectory = Join-Path $ProjectRoot "tools"
$CacheDirectory = Join-Path $ProjectRoot ".cache"

$FinalLaz = Join-Path $SourceDirectory "$Slug.laz"
$FinalCopc = Join-Path $ViewerDataDirectory "$Slug.copc.laz"
$FinalConvertReport = Join-Path $QaDirectory "$Slug-input-to-laz.json"
$FinalCopcReport = Join-Path $QaDirectory "$Slug-laz-to-copc.json"
$FinalManifest = Join-Path $QaDirectory "$Slug-build.json"
$FinalFiles = @($FinalLaz, $FinalCopc, $FinalConvertReport, $FinalCopcReport, $FinalManifest)

$ExistingFiles = @($FinalFiles | Where-Object { Test-Path -LiteralPath $_ })
if ($ExistingFiles.Count -gt 0 -and -not $Force) {
    $formatted = ($ExistingFiles | ForEach-Object { "  - $_" }) -join "`n"
    throw "Results already exist for slug '$Slug'. Use -Force to replace them explicitly:`n$formatted"
}

Write-Step "Check Python 3.12 and global user packages"
$Python = Resolve-PythonLauncher
$PythonExecutable = $Python.Executable
$PythonPrefixArguments = @($Python.PrefixArguments)
$versionProbeArguments = $PythonPrefixArguments + @(
    "-c",
    "import site, struct, sys; ok = sys.version_info[:2] == (3, 12) and struct.calcsize('P') == 8 and site.ENABLE_USER_SITE; raise SystemExit(0 if ok else 1)"
)
$versionProbeExit = Invoke-ProbeCommand `
    -Executable $PythonExecutable `
    -Arguments $versionProbeArguments
if ($versionProbeExit -ne 0) {
    throw "Python 3.12 (64-bit) with the user site-packages directory enabled is required. Checked: $PythonExecutable $($PythonPrefixArguments -join ' ')"
}

$dependencyProbe = @'
import importlib.metadata as metadata
expected = {
    'laspy': '2.7.0',
    'lazrs': '0.8.2',
    'numpy': '2.5.2',
    'pye57': '0.4.19',
    'pyquaternion': '0.9.9',
}
try:
    matches = all(metadata.version(k) == v for k, v in expected.items())
except metadata.PackageNotFoundError:
    matches = False
raise SystemExit(0 if matches else 1)
'@
$dependencyProbeArguments = $PythonPrefixArguments + @("-c", $dependencyProbe)
$dependencyProbeExit = Invoke-ProbeCommand `
    -Executable $PythonExecutable `
    -Arguments $dependencyProbeArguments
if ($dependencyProbeExit -ne 0) {
    Write-Step "Install missing packages once for the Windows user account"
    $pipArguments = $PythonPrefixArguments + @(
            "-m",
            "pip",
            "install",
            "--user",
            "--disable-pip-version-check",
            "--only-binary=:all:",
            "--requirement",
            $Requirements
        )
    Invoke-CheckedCommand -Executable $PythonExecutable `
        -Arguments $pipArguments `
        -Description "Installation of Python dependencies"

    $dependencyProbeExit = Invoke-ProbeCommand `
        -Executable $PythonExecutable `
        -Arguments $dependencyProbeArguments
    if ($dependencyProbeExit -ne 0) {
        throw "The pinned Python package versions are not active after installation."
    }
}

$Converter = Get-CopcConverter -ToolsDirectory $ToolsDirectory -CacheDirectory $CacheDirectory

New-Item -ItemType Directory -Path $SourceDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $ViewerDataDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $QaDirectory -Force | Out-Null

$BuildRoot = Join-Path $ProjectRoot ".build"
$StageDirectory = Join-Path $BuildRoot ([Guid]::NewGuid().ToString("N"))
$StageSourceDirectory = Join-Path $StageDirectory "source"
$StageDataDirectory = Join-Path $StageDirectory "viewer\data"
$StageQaDirectory = Join-Path $StageDirectory "qa"
$StageTempDirectory = Join-Path $StageDirectory "copc-temp"
$StageLaz = Join-Path $StageSourceDirectory "$Slug.laz"
$StageCopc = Join-Path $StageDataDirectory "$Slug.copc.laz"
$StageConvertReport = Join-Path $StageQaDirectory "$Slug-input-to-laz.json"
$StageCopcReport = Join-Path $StageQaDirectory "$Slug-laz-to-copc.json"

$Succeeded = $false
try {
    foreach ($directory in @($StageSourceDirectory, $StageDataDirectory, $StageQaDirectory, $StageTempDirectory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    if ($IsMultipart) {
        Write-Step "Write $($ResolvedInputs.Count) parts of '$Name' unchanged to a color-preserving LAZ"
        $convertArguments = @(
            $PrepareScript,
            "convert-set",
            $StageLaz
        ) + $ResolvedInputs + @(
            "--report",
            $StageConvertReport,
            "--assume-common-coordinates"
        )
    }
    else {
        Write-Step "Convert '$Name' to a color-preserving LAZ"
        $convertArguments = @(
            $PrepareScript,
            "convert",
            $ResolvedInputs[0],
            $StageLaz,
            "--report",
            $StageConvertReport
        )
        if ($InputExtension -eq ".ply") {
            $convertArguments += @("--ply-up", $PlyUp)
        }
    }
    Invoke-CheckedCommand -Executable $PythonExecutable `
        -Arguments ($PythonPrefixArguments + $convertArguments) `
        -Description "E57/PLY-to-LAZ conversion"

    Write-Step "Convert LAZ to COPC"
    Invoke-CheckedCommand -Executable $Converter `
        -Arguments @(
            $StageLaz,
            $StageCopc,
            "--temp-dir",
            $StageTempDirectory,
            "--progress",
            "plain"
        ) `
        -Description "LAZ-to-COPC conversion"

    if (-not (Test-Path -LiteralPath $StageCopc -PathType Leaf)) {
        throw "The COPC converter did not create an output file: $StageCopc"
    }

    Write-Step "Check point count, coordinates, RGB, and COPC LOD"
    Invoke-CheckedCommand -Executable $PythonExecutable `
        -Arguments ($PythonPrefixArguments + @(
            $PrepareScript,
            "validate-copc",
            $StageLaz,
            $StageCopc,
            "--report",
            $StageCopcReport
        )) `
        -Description "COPC validation"

    if ($Force) {
        foreach ($path in $FinalFiles) {
            if (Test-Path -LiteralPath $path -PathType Leaf) {
                Remove-Item -LiteralPath $path -Force
            }
        }
    }

    Move-Item -LiteralPath $StageLaz -Destination $FinalLaz
    Move-Item -LiteralPath $StageCopc -Destination $FinalCopc
    Move-Item -LiteralPath $StageConvertReport -Destination $FinalConvertReport
    Move-Item -LiteralPath $StageCopcReport -Destination $FinalCopcReport

    $manifestInputs = @($ResolvedInputs | ForEach-Object {
        [ordered]@{
            file = [IO.Path]::GetFileName($_)
            format = [IO.Path]::GetExtension($_).TrimStart('.').ToUpperInvariant()
            sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    })
    if ($IsMultipart) {
        $manifestAssembly = [ordered]@{
            mode = "direct concatenation; no registration, resampling, or deduplication"
            common_coordinates_acknowledged = $true
            registration_status = "pending visual seam check"
        }
        $manifestStatus = "serialization validated; registration pending visual seam check"
    }
    else {
        $manifestAssembly = [ordered]@{
            mode = "single input"
            registration_status = "not applicable"
        }
        $manifestStatus = "validated"
    }
    $manifest = [ordered]@{
        name = $Name
        slug = $Slug
        generated_utc = [DateTime]::UtcNow.ToString("o")
        inputs = $manifestInputs
        assembly = $manifestAssembly
        outputs = [ordered]@{
            laz = "source/$Slug.laz"
            copc = "viewer/data/$Slug.copc.laz"
        }
        reports = @(
            "qa/$Slug-input-to-laz.json",
            "qa/$Slug-laz-to-copc.json"
        )
        tools = [ordered]@{
            python = (& $PythonExecutable @PythonPrefixArguments --version 2>&1 | Out-String).Trim()
            copc_converter = (& $Converter --version 2>&1 | Out-String).Trim()
        }
        status = $manifestStatus
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $FinalManifest -Encoding UTF8
    $Succeeded = $true
}
finally {
    if (Test-Path -LiteralPath $StageDirectory -PathType Container) {
        Remove-Item -LiteralPath $StageDirectory -Recurse -Force
    }
}

if ($Succeeded) {
    Write-Host "`nComplete and validated:" -ForegroundColor Green
    Write-Host "  Scan:   $Name ($Slug)"
    Write-Host "  LAZ:    $FinalLaz"
    Write-Host "  COPC:   $FinalCopc"
    Write-Host "  Report: $FinalCopcReport"
    if ($IsMultipart) {
        Write-Host "  Registration: check for double contours/seams in the viewer" -ForegroundColor Yellow
    }
    Write-Host "`nStart the viewer locally:"
    Write-Host "  & '$PythonExecutable' $($PythonPrefixArguments -join ' ') '$ProjectRoot\scripts\serve_viewer.py'"
}
