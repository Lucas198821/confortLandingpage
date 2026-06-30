$port = 8000
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Servidor corriendo en http://localhost:$port/"
Write-Host "Presiona Ctrl+C para detenerlo."

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $root $path.TrimStart("/")

    if (Test-Path $filePath -PathType Leaf) {
        $contentType = switch ([System.IO.Path]::GetExtension($filePath)) {
            ".html" { "text/html" }
            ".css"  { "text/css" }
            ".js"   { "application/javascript" }
            ".png"  { "image/png" }
            ".jpg"  { "image/jpeg" }
            ".ico"  { "image/x-icon" }
            default { "application/octet-stream" }
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length

        $ext = [System.IO.Path]::GetExtension($filePath)
        if ($ext -eq ".html") {
            $response.Headers.Add("Cache-Control", "no-cache, must-revalidate")
        } else {
            $response.Headers.Add("Cache-Control", "public, max-age=31536000, immutable")
        }

        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $errorBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.ContentLength64 = $errorBytes.Length
        $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
    }
    $response.OutputStream.Close()
}
$listener.Stop()
