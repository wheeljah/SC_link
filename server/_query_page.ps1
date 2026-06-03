$body = Get-Content 'D:\SC_link\server\_query_args.json' -Raw
$result = mavis browser tool query $body | ConvertFrom-Json
$content = $result.content
$content | Out-File 'D:\SC_link\server\cobalt_text.txt' -NoNewline -Encoding UTF8
Write-Host "Done. Length: $($content.Length)"