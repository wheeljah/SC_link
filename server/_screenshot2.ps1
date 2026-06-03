$result = mavis browser tool screenshot '{}' | ConvertFrom-Json
$content = $result.content
# Strip data URL prefix if present
if ($content -is [string] -and $content.StartsWith('data:')) {
    $base64 = $content.Substring($content.IndexOf(',') + 1)
    [System.IO.File]::WriteAllBytes('D:\SC_link\server\cobalt_screen.png', [System.Convert]::FromBase64String($base64))
    Write-Host "Saved PNG: $((Get-Item 'D:\SC_link\server\cobalt_screen.png').Length) bytes"
} else {
    Write-Host "No data URL, content type: $($content.GetType().Name)"
}
