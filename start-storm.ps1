#Requires -Version 5.1
<#
  Storm POC — Lanceur local Windows.

  Ce script ne touche à AUCUN fichier applicatif de Storm (Tectonic,
  Ivory, Pangea, Manifest, Candidate, Compiler, Publish). Il se
  contente de : vérifier les prérequis, demander le mot de passe admin
  de façon interactive (jamais écrit sur disque), démarrer Storm
  directement via node server.js (pas npm, pour éviter toute politique
  d'exécution PowerShell d'entreprise appliquée spécifiquement à npm),
  attendre qu'il réponde, puis exposer un tunnel Cloudflare public
  temporaire.

  Usage : double-cliquer sur "Start Storm.cmd" (à côté de ce fichier),
  ou exécuter directement :
    powershell -ExecutionPolicy Bypass -File start-storm.ps1
#>

$ErrorActionPreference = 'Stop'

# ─────────────────────────────────────────────────────────────────
# 1. Se placer automatiquement dans le répertoire du repo — celui qui
#    contient ce script lui-même, jamais un chemin codé en dur.
# ─────────────────────────────────────────────────────────────────
Set-Location -Path $PSScriptRoot

Write-Host "=== Storm POC — Lanceur local ===" -ForegroundColor Cyan
Write-Host "Répertoire du repo : $PSScriptRoot"
Write-Host ""

# ─────────────────────────────────────────────────────────────────
# 2 & 3. Vérifier les prérequis. Aucune tentative d'installation
#    automatique, silencieuse ou non — sur un poste professionnel,
#    ce n'est jamais au script de décider d'installer quoi que ce soit.
# ─────────────────────────────────────────────────────────────────
function Test-Prerequisite {
    param(
        [string]$Name,
        [string]$InstallHint
    )
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host ""
        Write-Host "ERREUR : '$Name' est introuvable dans le PATH." -ForegroundColor Red
        Write-Host $InstallHint -ForegroundColor Yellow
        Write-Host "Ce script n'installe jamais rien automatiquement — installez manuellement, puis relancez." -ForegroundColor Yellow
        Read-Host "Appuyez sur Entrée pour fermer cette fenêtre"
        exit 1
    }
    Write-Host "OK — $Name trouvé : $($cmd.Source)" -ForegroundColor Green
    return $cmd
}

$nodeCmd = Test-Prerequisite -Name "node" -InstallHint "Installez Node.js (version LTS) depuis https://nodejs.org/, puis relancez ce lanceur."

Test-Prerequisite -Name "cloudflared" -InstallHint (
    "Téléchargez cloudflared depuis https://github.com/cloudflare/cloudflared/releases`n" +
    "(fichier cloudflared-windows-amd64.exe), renommez-le en cloudflared.exe, et placez-le`n" +
    "soit dans un dossier déjà présent dans votre PATH, soit dans ce même répertoire."
) | Out-Null

Write-Host ""

# ─────────────────────────────────────────────────────────────────
# 5. Demander ADMIN_PASSWORD de manière interactive — jamais écrit
#    dans le repo, jamais dans un fichier, jamais journalisé en clair.
#    Uniquement placé dans la variable d'environnement du PROCESSUS
#    PowerShell courant, héritée par le processus Node enfant, et
#    perdue à la fermeture de cette fenêtre.
# ─────────────────────────────────────────────────────────────────
$secure = Read-Host -Prompt "Mot de passe admin Storm (ADMIN_PASSWORD) — laisser vide pour garder la valeur par défaut du code" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($plain)) {
    Write-Host "Aucun mot de passe saisi : la valeur par défaut du code sera utilisée." -ForegroundColor Yellow
    Write-Host "À réserver à un usage strictement local — jamais pour une instance exposée sans y penser." -ForegroundColor Yellow
} else {
    $env:ADMIN_PASSWORD = $plain
    Write-Host "Mot de passe admin défini pour cette session (jamais écrit sur disque)." -ForegroundColor Green
}
$plain = $null
$secure = $null

Write-Host ""

# ─────────────────────────────────────────────────────────────────
# 6, 7, 8, 9, 10, 11 — démarrage, attente, tunnel, affichage, maintien,
#    arrêt propre.
# ─────────────────────────────────────────────────────────────────
$nodeProcess = $null
$cloudflaredProcess = $null
$script:publicUrl = $null
$script:urlFound = $false

try {
    # 6. Démarrer Storm directement via node + server.js (jamais npm,
    #    dont l'exécution via PowerShell peut être soumise à une
    #    politique d'entreprise indépendante de celle appliquée à ce
    #    script lui-même). server.js n'a de toute façon aucune
    #    dépendance npm externe — "npm start" ne faisait qu'appeler
    #    "node server.js", donc rien n'est perdu à appeler ce dernier
    #    directement, avec l'exécutable node déjà détecté ci-dessus.
    Write-Host "Démarrage de Storm (node server.js)..." -ForegroundColor Cyan
    $nodePsi = New-Object System.Diagnostics.ProcessStartInfo
    $nodePsi.FileName = $nodeCmd.Source
    $nodePsi.Arguments = "server.js"
    $nodePsi.WorkingDirectory = $PSScriptRoot
    $nodePsi.UseShellExecute = $false
    $nodeProcess = [System.Diagnostics.Process]::Start($nodePsi)

    # 7. Attendre que http://localhost:3000 réponde.
    Write-Host "Attente de la disponibilité de http://localhost:3000 ..."
    $ready = $false
    $timeoutSeconds = 30
    $elapsed = 0
    while (-not $ready -and $elapsed -lt $timeoutSeconds) {
        Start-Sleep -Seconds 1
        $elapsed++
        if ($nodeProcess.HasExited) {
            throw "Le processus Storm s'est arrêté de façon inattendue (code $($nodeProcess.ExitCode)) avant d'avoir répondu."
        }
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -eq 200) { $ready = $true }
        } catch {
            # Pas encore prêt — normal pendant le démarrage, on continue d'attendre.
        }
    }
    if (-not $ready) {
        throw "Storm n'a pas répondu sur http://localhost:3000 après $timeoutSeconds secondes."
    }
    Write-Host "Storm est en ligne : http://localhost:3000" -ForegroundColor Green
    Write-Host ""

    # 8. Démarrer le tunnel Cloudflare.
    Write-Host "Démarrage du tunnel Cloudflare (cloudflared)..." -ForegroundColor Cyan
    $cfPsi = New-Object System.Diagnostics.ProcessStartInfo
    $cfPsi.FileName = "cloudflared"
    $cfPsi.Arguments = "tunnel --url http://localhost:3000"
    $cfPsi.UseShellExecute = $false
    $cfPsi.RedirectStandardOutput = $true
    $cfPsi.RedirectStandardError = $true
    $cfPsi.CreateNoWindow = $true

    $cloudflaredProcess = New-Object System.Diagnostics.Process
    $cloudflaredProcess.StartInfo = $cfPsi

    $outputHandler = {
        param($sender, $e)
        if ($null -ne $e.Data) {
            Write-Host $e.Data
            if (-not $script:urlFound -and $e.Data -match 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com') {
                $script:publicUrl = $Matches[0]
                $script:urlFound = $true
            }
        }
    }
    Register-ObjectEvent -InputObject $cloudflaredProcess -EventName OutputDataReceived -Action $outputHandler | Out-Null
    Register-ObjectEvent -InputObject $cloudflaredProcess -EventName ErrorDataReceived -Action $outputHandler | Out-Null

    $cloudflaredProcess.Start() | Out-Null
    $cloudflaredProcess.BeginOutputReadLine()
    $cloudflaredProcess.BeginErrorReadLine()

    Write-Host "Recherche de l'URL publique (jusqu'à 20 secondes)..."
    $cfElapsed = 0
    while (-not $script:urlFound -and $cfElapsed -lt 20) {
        Start-Sleep -Seconds 1
        $cfElapsed++
        if ($cloudflaredProcess.HasExited) {
            Write-Host "cloudflared s'est arrêté de façon inattendue (code $($cloudflaredProcess.ExitCode))." -ForegroundColor Red
            break
        }
    }

    # 9. Afficher clairement les deux URLs.
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " Storm est en ligne"
    Write-Host " URL locale   : http://localhost:3000"
    if ($script:urlFound) {
        Write-Host " URL publique : $($script:publicUrl)" -ForegroundColor Green
    } else {
        Write-Host " URL publique : pas encore détectée automatiquement — voir les logs cloudflared ci-dessus." -ForegroundColor Yellow
    }
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Laissez cette fenêtre ouverte tant que vous utilisez Storm."
    Write-Host "Appuyez sur Ctrl+C pour tout arrêter proprement (recommandé plutôt que fermer la fenêtre directement)." -ForegroundColor Yellow
    Write-Host ""

    # 10. Conserver les processus actifs tant que la fenêtre reste ouverte.
    while (-not $nodeProcess.HasExited -and -not $cloudflaredProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
    if ($nodeProcess.HasExited) {
        Write-Host "Le processus Storm s'est arrêté (code $($nodeProcess.ExitCode))." -ForegroundColor Yellow
    }
    if ($cloudflaredProcess.HasExited) {
        Write-Host "Le tunnel Cloudflare s'est arrêté (code $($cloudflaredProcess.ExitCode))." -ForegroundColor Yellow
    }

} finally {
    # 11. Fermer proprement les processus enfants à l'arrêt — couvre
    #     Ctrl+C et la sortie normale du script. Une fermeture brutale
    #     de la fenêtre (bouton X) peut, selon la configuration Windows,
    #     ne pas exécuter ce bloc — voir la documentation livrée avec
    #     ce script pour cette limitation connue.
    Write-Host ""
    Write-Host "Arrêt en cours..." -ForegroundColor Cyan
    if ($cloudflaredProcess -and -not $cloudflaredProcess.HasExited) {
        try { $cloudflaredProcess.Kill() } catch { }
    }
    if ($nodeProcess -and -not $nodeProcess.HasExited) {
        try { $nodeProcess.Kill() } catch { }
    }
    Write-Host "Storm et le tunnel Cloudflare ont été arrêtés." -ForegroundColor Cyan
}
