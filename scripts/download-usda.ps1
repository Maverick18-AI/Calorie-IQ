# Official exports only. Raw archives/extracted JSON stay ignored and never ship.
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$specPath = Join-Path $projectRoot 'data/usda/sources.json'
$spec = Get-Content -LiteralPath $specPath -Raw | ConvertFrom-Json
$sourceRoot = Join-Path $projectRoot '.source-data'
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($item in $spec.sources) {
    if (([uri]$item.url).Scheme -ne 'https' -or ([uri]$item.url).Host -ne 'fdc.nal.usda.gov') { throw 'Only official USDA downloads are permitted' }
    $archive = Join-Path $sourceRoot ($item.id + '.zip')
    if (-not (Test-Path -LiteralPath $archive)) {
        $head = Invoke-WebRequest -Uri $item.url -Method Head -UseBasicParsing
        $length = [long](@($head.Headers['Content-Length'])[0])
        if ($length -le 0 -or $length -gt 20000000) { throw 'Archive exceeds the approved 20 MB per-file bound; review before downloading' }
        Invoke-WebRequest -Uri $item.url -OutFile $archive -UseBasicParsing
    }
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($item.sha256 -and $hash -ne $item.sha256) { throw ('USDA archive changed: ' + $item.id) }
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $entries = @($zip.Entries | Where-Object { $_.Name -like '*.json' })
        if ($entries.Count -ne 1 -or $entries[0].Length -gt 260000000) { throw 'Unexpected archive contents/size; review before extraction' }
        $target = Join-Path $sourceRoot ($item.id + '.json')
        $inputStream = $entries[0].Open()
        $outputStream = [IO.File]::Create($target)
        try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
        if ($item.jsonSha256 -and (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.jsonSha256) { throw ('Extracted JSON changed: ' + $item.id) }
        Write-Output ($item.id + ': ' + (Get-Item -LiteralPath $archive).Length + ' archive bytes, ' + $entries[0].Length + ' JSON bytes, SHA256 ' + $hash)
    } finally { $zip.Dispose() }
}
