$result = mavis browser tool screenshot '{}' | ConvertFrom-Json
$content = $result.content
if ($content -like 'data:*') {
    $content -replace '^data:image/png;base64,','' | Out-File 'D:\SC_link\server\cobalt_b64.txt' -NoNewline
} else {
    $content | Out-File 'D:\SC_link\server\cobalt_b64.txt' -NoNewline
}
Write-Host "Done. Length: $((Get-Content 'D:\SC_link\server\cobalt_b64.txt' -Raw).Length)"
