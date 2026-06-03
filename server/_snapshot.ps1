$body = Get-Content 'D:\SC_link\server\_snapshot_args.json' -Raw
$result = mavis browser tool snapshot $body | ConvertFrom-Json
$jsonStr = $result.content
$jsonStr | Out-File 'D:\SC_link\server\cobalt_snapshot.json' -NoNewline -Encoding UTF8
Write-Host "Done. Length: $($jsonStr.Length)"